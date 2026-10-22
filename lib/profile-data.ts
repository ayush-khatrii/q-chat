import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import prisma from "@/lib/prisma";

export type ProfileRoom = {
  id: string;
  code: string;
  name: string;
  memberCount: number;
  createdAt: string;
};

export type MyProfileData = {
  createdRooms: ProfileRoom[];
  joinedRooms: ProfileRoom[];
};

export type UserProfileData = {
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    createdAt: string;
  };
  isMe: boolean;
  sharedRooms: {
    id: string;
    code: string;
    name: string;
    ownerId: string;
    joinedAt: string;
  }[];
  createdRoomsCount: number;
  joinedRoomsCount: number;
};

export async function getCachedPublicUser(userId: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`profile:${userId}`);
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      createdAt: true,
    },
  });
}

const roomSelect = {
  id: true,
  code: true,
  name: true,
  createdAt: true,
  _count: { select: { roomMembers: true } },
} as const;

export async function getMyProfileData(userId: string): Promise<MyProfileData> {
  const [createdRooms, joinedRooms] = await Promise.all([
    prisma.room.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: "desc" },
      select: roomSelect,
    }),
    prisma.room.findMany({
      where: {
        ownerId: { not: userId },
        roomMembers: { some: { userId } },
      },
      orderBy: { createdAt: "desc" },
      select: roomSelect,
    }),
  ]);
  const serialize = (rooms: typeof createdRooms): ProfileRoom[] =>
    rooms.map((room) => ({
      id: room.id,
      code: room.code,
      name: room.name,
      memberCount: room._count.roomMembers,
      createdAt: room.createdAt.toISOString(),
    }));
  return { createdRooms: serialize(createdRooms), joinedRooms: serialize(joinedRooms) };
}

export async function getUserProfileData(
  userId: string,
  viewerId: string,
): Promise<UserProfileData | null> {
  const [user, sharedMemberships, createdRoomsCount, joinedRoomsCount] =
    await Promise.all([
      getCachedPublicUser(userId),
      prisma.roomMember.findMany({
        where: {
          userId,
          room: { roomMembers: { some: { userId: viewerId } } },
        },
        select: {
          joinedAt: true,
          room: { select: { id: true, code: true, name: true, ownerId: true } },
        },
        orderBy: { joinedAt: "desc" },
      }),
      prisma.room.count({ where: { ownerId: userId } }),
      prisma.roomMember.count({ where: { userId } }),
    ]);
  if (!user) return null;
  return {
    user: { ...user, createdAt: user.createdAt.toISOString() },
    isMe: viewerId === userId,
    sharedRooms: sharedMemberships.map((membership) => ({
      ...membership.room,
      joinedAt: membership.joinedAt.toISOString(),
    })),
    createdRoomsCount,
    joinedRoomsCount,
  };
}
