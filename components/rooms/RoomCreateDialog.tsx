"use client";

import { useState } from "react";
import { KeyRound, Sparkles } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createRoomSchema, MAX_CUSTOM_ROOM_CODE_LENGTH } from "@/lib/rooms";

type RoomCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isCreating: boolean;
  onCreate: (name: string, customCode?: string) => Promise<void>;
};

type FieldErrors = {
  name?: string;
  customCode?: string;
  form?: string;
};

function toFieldErrors(error: z.ZodError): FieldErrors {
  return error.issues.reduce<FieldErrors>((errors, issue) => {
    const key = issue.path[0];

    if (key === "name" || key === "customCode") {
      return {
        ...errors,
        [key]: issue.message,
      };
    }

    return {
      ...errors,
      form: issue.message,
    };
  }, {});
}

export default function RoomCreateDialog({
  open,
  onOpenChange,
  isCreating,
  onCreate,
}: RoomCreateDialogProps) {
  const [name, setName] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  const submitRoom = async (useCustomCode: boolean) => {
    const parsedRoom = createRoomSchema.safeParse({
      name,
      customCode: useCustomCode ? customCode : undefined,
    });

    if (!parsedRoom.success) {
      setErrors(toFieldErrors(parsedRoom.error));
      return;
    }

    setErrors({});

    try {
      await onCreate(parsedRoom.data.name, parsedRoom.data.customCode);
      setName("");
      setCustomCode("");
      onOpenChange(false);
    } catch (error) {
      setErrors({
        form:
          error instanceof Error
            ? error.message
            : "Room could not be created.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create room</DialogTitle>
          <DialogDescription>
            Create a private room for your account. Leave the code empty to generate a secure QC code.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium" htmlFor="room-name">
              Room name
            </label>
            <Input
              id="room-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setErrors((current) => ({ ...current, name: undefined }));
              }}
              placeholder="Project standup"
              disabled={isCreating}
              aria-invalid={Boolean(errors.name)}
            />
            {errors.name ? (
              <p className="text-[0.6875rem] text-destructive">{errors.name}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium" htmlFor="room-code">
              Custom room code
            </label>
            <div className="flex items-center gap-2">
              <div className="flex h-7 shrink-0 items-center rounded-md border border-input bg-muted px-2 font-mono text-xs text-muted-foreground">
                QC-
              </div>
              <Input
                id="room-code"
                value={customCode}
                onChange={(event) => {
                  setCustomCode(
                    event.target.value
                      .replace(/^QC-/i, "")
                      .toUpperCase()
                      .slice(0, MAX_CUSTOM_ROOM_CODE_LENGTH),
                  );
                  setErrors((current) => ({
                    ...current,
                    customCode: undefined,
                  }));
                }}
                placeholder="TEAM-01"
                disabled={isCreating}
                aria-invalid={Boolean(errors.customCode)}
              />
            </div>
            {errors.customCode ? (
              <p className="text-[0.6875rem] text-destructive">
                {errors.customCode}
              </p>
            ) : (
              <p className="text-[0.6875rem] text-muted-foreground">
                Custom codes support letters, numbers, and hyphens up to 20 characters including QC-.
              </p>
            )}
          </div>

          {errors.form ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {errors.form}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => void submitRoom(false)}
            disabled={isCreating}
          >
            <Sparkles />
            Auto-generate
          </Button>
          <Button
            type="button"
            onClick={() => void submitRoom(true)}
            disabled={isCreating || customCode.trim().length === 0}
          >
            <KeyRound />
            Create custom
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
