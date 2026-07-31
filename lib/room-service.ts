import "server-only";

import prisma from "@/lib/prisma";
import type { UserRoom } from "@/lib/rooms";

type RoomRecord = {
  id: string;
  name: string;
  code: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    roomMembers: number;
  };
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
};

export function serializeRoom(room: RoomRecord, userId: string): UserRoom {
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

export async function getRoomForMember(code: string, userId: string) {
  const room = await prisma.room.findFirst({
    where: {
      code,
      roomMembers: {
        some: { userId },
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
        select: { roomMembers: true },
      },
      roomMembers: {
        orderBy: { joinedAt: "asc" },
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

  return room ? serializeRoom(room, userId) : null;
}
