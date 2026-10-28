"use client";

import { Trash2 } from "lucide-react";
import { useLayoutEffect, useState, useTransition } from "react";
import { deleteGroupAction } from "@/app/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type DeleteGroupButtonProps = {
  id: number;
  name: string;
};

export function DeleteGroupButton({ id, name }: DeleteGroupButtonProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // Next.js keeps visited pages mounted but hidden, so close the dialog
  // when the user leaves; otherwise it is still open on coming back
  useLayoutEffect(() => () => setOpen(false), []);

  return (
    <AlertDialog
      open={open}
      // Keep the dialog open while the deletion is in progress
      onOpenChange={(nextOpen) => !pending && setOpen(nextOpen)}
    >
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            className="text-coral-700 hover:bg-coral-50 hover:text-coral-700"
          />
        }
      >
        <Trash2 aria-hidden="true" />
        Удалить
        <span className="sr-only"> группу «{name}»</span>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить группу?</AlertDialogTitle>
          <AlertDialogDescription>
            Группа «{name}» будет удалена. Контакты из неё останутся в CRM.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Отмена</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={() => startTransition(() => deleteGroupAction(id))}
          >
            {pending ? "Удаляю…" : "Удалить"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
