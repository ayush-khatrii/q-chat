import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  createRoomSchema,
  generateRoomCode,
  normalizeCustomRoomCode,
} from "@/lib/rooms";

async function getAuthenticatedUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return session?.user ?? null;
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function serializeRoom(
  room: Awaited<ReturnType<typeof prisma.room.findMany>>[number] & {
    roomMembers: {
      id: string;
      userId: string;
      roomId: string;
      joinedAt: Date;
      user: {
        id: string;
        name: string | null;
        email: string;
        image: string | null;
      };
    }[];
    _count: {
      roomMembers: number;
    };
  },
  userId: string,
) {
  return {
    id: room.id,
    name: room.name,
    code: room.code,
    ownerId: room.ownerId,
    isOwner: room.ownerId === userId,
    memberCount: room._count.roomMembers,
    members: room.roomMembers.map((member) => ({
      ...member,
      joinedAt: member.joinedAt.toISOString(),
    })),
    createdAt: room.createdAt.toISOString(),
    updatedAt: room.updatedAt.toISOString(),
  };
}

export async function GET() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rooms = await prisma.room.findMany({
    where: {
      roomMembers: {
        some: {
          userId: user.id,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      name: true,
      code: true,
      ownerId: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          roomMembers: true,
        },
      },
      roomMembers: {
        orderBy: {
          joinedAt: "asc",
        },
        select: {
          id: true,
          userId: true,
          roomId: true,
          joinedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      },
    },
  });

  return NextResponse.json({
    rooms: rooms.map((room) => serializeRoom(room, user.id)),
  });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsedBody = createRoomSchema.safeParse(json);

  if (!parsedBody.success) {
    return NextResponse.json(
      { error: parsedBody.error.issues[0]?.message ?? "Invalid room payload." },
      { status: 400 },
    );
  }

  const existingOwnedRoom = await prisma.room.findFirst({
    where: {
      ownerId: user.id,
    },
    select: {
      id: true,
      code: true,
    },
  });

  if (existingOwnedRoom) {
    return NextResponse.json(
      {
        error: `You already created room ${existingOwnedRoom.code}. Delete it before creating another room.`,
      },
      { status: 409 },
    );
  }

  const { name, customCode } = parsedBody.data;
  const normalizedCustomCode = normalizeCustomRoomCode(customCode);
  const maxAttempts = normalizedCustomCode ? 1 : 10;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = normalizedCustomCode ?? generateRoomCode();

    try {
      const room = await prisma.room.create({
        data: {
          name,
          code,
          ownerId: user.id,
          roomMembers: {
            create: {
              userId: user.id,
            },
          },
        },
        select: {
          id: true,
          name: true,
          code: true,
          ownerId: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              roomMembers: true,
            },
          },
          roomMembers: {
            select: {
              id: true,
              userId: true,
              roomId: true,
              joinedAt: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                },
              },
            },
          },
        },
      });

      return NextResponse.json(
        {
          room: serializeRoom(room, user.id),
        },
        { status: 201 },
      );
    } catch (error) {
      if (isUniqueConstraintError(error) && normalizedCustomCode) {
        return NextResponse.json(
          { error: "That room code is already taken. Try another one." },
          { status: 409 },
        );
      }

      if (isUniqueConstraintError(error)) {
        continue;
      }

      throw error;
    }
  }

  return NextResponse.json(
    { error: "Unable to generate a unique room code. Please try again." },
    { status: 500 },
  );
}
