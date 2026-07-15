import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import type { UserRoom } from "@/lib/rooms";

type RoomsResponse = {
  rooms: UserRoom[];
};

type CreateRoomResponse = {
  room: UserRoom;
};

type RemoveRoomResponse = {
  action: "deleted" | "left";
};

const ROOM_CACHE_PREFIX = "qchat:rooms";

function getPayloadError(payload: unknown, fallbackMessage: string) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return fallbackMessage;
}

function isRoomsResponse(payload: unknown): payload is RoomsResponse {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "rooms" in payload &&
    Array.isArray(payload.rooms)
  );
}

function isCreateRoomResponse(payload: unknown): payload is CreateRoomResponse {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "room" in payload &&
    typeof payload.room === "object" &&
    payload.room !== null
  );
}

function getRoomsCacheKey(cacheScope?: string | null) {
  return cacheScope ? `${ROOM_CACHE_PREFIX}:${cacheScope}` : null;
}

function readCachedRooms(cacheKey: string | null) {
  if (!cacheKey || typeof window === "undefined") {
    return [];
  }

  try {
    const cachedRooms = window.localStorage.getItem(cacheKey);

    if (!cachedRooms) {
      return [];
    }

    const parsedRooms = JSON.parse(cachedRooms);

    return isRoomsResponse(parsedRooms) ? parsedRooms.rooms : [];
  } catch {
    return [];
  }
}

function writeCachedRooms(cacheKey: string | null, rooms: UserRoom[]) {
  if (!cacheKey || typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(cacheKey, JSON.stringify({ rooms }));
  } catch {
    // Browsers can reject storage in private mode. The network response still wins.
  }
}

function clearCachedRooms(cacheKey: string | null) {
  if (!cacheKey || typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(cacheKey);
  } catch {
    // Cache cleanup is best-effort only.
  }
}

export function useRooms(enabled = true, cacheScope?: string | null) {
  const cacheKey = getRoomsCacheKey(cacheScope);
  const [rooms, setRooms] = useState<UserRoom[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (!enabled) {
      setRooms([]);
      setHasLoaded(false);
      setIsLoading(false);
      setError(null);
      return;
    }

    const cachedRooms = readCachedRooms(cacheKey);

    if (cachedRooms.length > 0) {
      setRooms(cachedRooms);
      setHasLoaded(true);
    }
  }, [cacheKey, enabled]);

  const fetchRooms = useCallback(async (showBlockingLoader = false) => {
    if (!enabled) {
      setRooms([]);
      setIsLoading(false);
      setHasLoaded(false);
      setError(null);
      return;
    }

    setIsLoading(showBlockingLoader);

    try {
      const response = await fetch("/api/rooms", {
        credentials: "include",
        cache: "no-store",
      });

      const payload = (await response.json().catch(() => null)) as
        | RoomsResponse
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(getPayloadError(payload, "Unable to load your rooms."));
      }

      const nextRooms = isRoomsResponse(payload) ? payload.rooms : [];

      setRooms(nextRooms);
      writeCachedRooms(cacheKey, nextRooms);
      setError(null);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Unable to load your rooms.",
      );
    } finally {
      setHasLoaded(true);
      setIsLoading(false);
    }
  }, [cacheKey, enabled]);

  const createRoom = useCallback(async (name: string, customCode?: string) => {
    setIsCreating(true);

    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ name, customCode }),
      });

      const payload = (await response.json().catch(() => null)) as
        | CreateRoomResponse
        | { error?: string }
        | null;

      if (!response.ok || !isCreateRoomResponse(payload)) {
        throw new Error(getPayloadError(payload, "Unable to create your room."));
      }

      setRooms((currentRooms) => {
        const nextRooms = [payload.room, ...currentRooms];

        writeCachedRooms(cacheKey, nextRooms);

        return nextRooms;
      });
      setHasLoaded(true);
      setError(null);

      return payload.room;
    } catch (createError) {
      const message =
        createError instanceof Error
          ? createError.message
          : "Unable to create your room.";

      setError(message);
      throw createError;
    } finally {
      setIsCreating(false);
    }
  }, [cacheKey]);

  const removeRoom = useCallback(async (roomId: string) => {
    try {
      const response = await fetch(`/api/rooms/${roomId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const payload = (await response.json().catch(() => null)) as
        | RemoveRoomResponse
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(getPayloadError(payload, "Unable to update room."));
      }

      setRooms((currentRooms) => {
        const nextRooms = currentRooms.filter((room) => room.id !== roomId);

        if (nextRooms.length > 0) {
          writeCachedRooms(cacheKey, nextRooms);
        } else {
          clearCachedRooms(cacheKey);
        }

        return nextRooms;
      });
      setHasLoaded(true);
      setError(null);

      return payload && "action" in payload ? payload.action : "deleted";
    } catch (removeError) {
      const message =
        removeError instanceof Error
          ? removeError.message
          : "Unable to update room.";

      setError(message);
      throw removeError;
    }
  }, [cacheKey]);

  const joinRoom = useCallback(async (code: string) => {
    setIsJoining(true);

    try {
      const response = await fetch("/api/rooms/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ code }),
      });

      const payload = (await response.json().catch(() => null)) as
        | CreateRoomResponse
        | { error?: string }
        | null;

      if (!response.ok || !isCreateRoomResponse(payload)) {
        throw new Error(getPayloadError(payload, "Unable to join the room."));
      }

      setRooms((currentRooms) => {
        const withoutDuplicate = currentRooms.filter(
          (room) => room.id !== payload.room.id,
        );
        const nextRooms = [payload.room, ...withoutDuplicate];

        writeCachedRooms(cacheKey, nextRooms);
        return nextRooms;
      });
      setHasLoaded(true);
      setError(null);

      return payload.room;
    } catch (joinError) {
      const message =
        joinError instanceof Error
          ? joinError.message
          : "Unable to join the room.";

      setError(message);
      throw joinError;
    } finally {
      setIsJoining(false);
    }
  }, [cacheKey]);

  useEffect(() => {
    void fetchRooms(false);
  }, [fetchRooms]);

  return {
    rooms,
    isLoading,
    isCreating,
    isJoining,
    hasLoaded,
    error,
    createRoom,
    joinRoom,
    removeRoom,
    refetch: fetchRooms,
  };
}
