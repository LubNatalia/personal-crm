"use client";

import { Trash2 } from "lucide-react";
import { useLayoutEffect, useState, useTransition } from "react";
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
import { deleteContactAction } from "@/app/actions";

type DeleteContactButtonProps = {
  id: number;
  name: string;
};

export function DeleteContactButton({ id, name }: DeleteContactButtonProps) {
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
            className="w-full text-coral-700 hover:bg-coral-50 hover:text-coral-700 sm:w-auto"
          />
        }
      >
        <Trash2 aria-hidden="true" />
        Удалить контакт
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить контакт?</AlertDialogTitle>
          <AlertDialogDescription>
            Контакт «{name}» и заметки о нём будут удалены. Это нельзя отменить.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Отмена</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={() => startTransition(() => deleteContactAction(id))}
          >
            {pending ? "Удаляю…" : "Удалить"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
