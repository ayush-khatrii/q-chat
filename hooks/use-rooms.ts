"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { JoinRoomResult, UserRoom } from "@/lib/rooms";

type RoomsResponse = { rooms: UserRoom[] };
type CreateRoomResponse = { room: UserRoom };
type RemoveRoomResponse = { action: "deleted" | "left" };

export const roomsQueryKey = (userId?: string | null) =>
  ["rooms", userId ?? "anonymous"] as const;

function payloadError(payload: unknown, fallback: string) {
  return payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
    ? payload.error
    : fallback;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", ...init });
  const payload = (await response.json().catch(() => null)) as T | null;
  if (!response.ok || !payload) {
    throw new Error(payloadError(payload, "Unable to load your rooms."));
  }
  return payload;
}

export function useRooms(enabled = true, userId?: string | null) {
  const queryClient = useQueryClient();
  const queryKey = roomsQueryKey(userId);
  const query = useQuery({
    queryKey,
    queryFn: () => requestJson<RoomsResponse>("/api/rooms"),
    enabled: enabled && Boolean(userId),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!enabled || !userId) return;
    const refresh = () => void queryClient.invalidateQueries({ queryKey });
    window.addEventListener("qchat:membership-changed", refresh);
    return () =>
      window.removeEventListener("qchat:membership-changed", refresh);
  }, [enabled, queryClient, queryKey, userId]);

  const create = useMutation({
    mutationFn: async ({ name, customCode }: { name: string; customCode?: string }) =>
      requestJson<CreateRoomResponse>("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, customCode }),
      }),
    onSuccess: ({ room }) => {
      queryClient.setQueryData<RoomsResponse>(queryKey, (current) => ({
        rooms: [room, ...(current?.rooms ?? []).filter((item) => item.id !== room.id)],
      }));
      window.dispatchEvent(new Event("qchat:membership-changed"));
    },
  });

  const join = useMutation({
    mutationFn: (code: string) =>
      requestJson<JoinRoomResult>("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      }),
    onSuccess: (result) => {
      if (result.status === "joined") {
        queryClient.setQueryData<RoomsResponse>(queryKey, (current) => ({
          rooms: [
            result.room,
            ...(current?.rooms ?? []).filter((item) => item.id !== result.room.id),
          ],
        }));
        window.dispatchEvent(new Event("qchat:membership-changed"));
      }
    },
  });

  const remove = useMutation({
    mutationFn: async (roomId: string) => ({
      roomId,
      result: await requestJson<RemoveRoomResponse>(`/api/rooms/${roomId}`, {
        method: "DELETE",
      }),
    }),
    onSuccess: ({ roomId }) => {
      queryClient.setQueryData<RoomsResponse>(queryKey, (current) => ({
        rooms: (current?.rooms ?? []).filter((room) => room.id !== roomId),
      }));
      window.dispatchEvent(new Event("qchat:membership-changed"));
    },
  });

  const error = create.error ?? join.error ?? remove.error ?? query.error;
  return {
    rooms: query.data?.rooms ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isCreating: create.isPending,
    isJoining: join.isPending,
    hasLoaded: query.isFetched,
    error: error instanceof Error ? error.message : null,
    createRoom: async (name: string, customCode?: string) =>
      (await create.mutateAsync({ name, customCode })).room,
    joinRoom: join.mutateAsync,
    removeRoom: async (roomId: string) =>
      (await remove.mutateAsync(roomId)).result.action,
    refetch: async () => {
      await query.refetch();
    },
  };
}
