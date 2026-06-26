import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createProject } from "@/lib/project-api";
import { useToast } from "@/providers/ToastProvider";

const KEY_RE = /^[a-z0-9-_]+$/;

export function CreateProjectDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (key: string) => void;
}) {
  const toast = useToast();
  const [key, setKey] = useState("");
  const [name, setName] = useState("");

  const reset = () => {
    setKey("");
    setName("");
  };

  const mutation = useMutation({
    mutationFn: () => createProject(key.trim().toLowerCase(), name.trim()),
    onSuccess: (data) => {
      toast.show("Proje oluşturuldu");
      const createdKey = data.project?.key ?? key.trim().toLowerCase();
      onCreated(createdKey);
      reset();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const handleSubmit = () => {
    const k = key.trim().toLowerCase();
    const n = name.trim();
    if (!k || !n) {
      toast.show("Anahtar ve görünen ad gerekli", "error");
      return;
    }
    if (!KEY_RE.test(k)) {
      toast.show("Anahtar: küçük harf, rakam, - ve _", "error");
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-4 w-4" />
            Yeni proje
          </DialogTitle>
          <DialogDescription>
            Proje anahtarı sohbet ve run bağlamında kullanılır. Oluşturduktan sonra bağlantıları ve
            context graph&apos;ı bu sayfadan yönetebilirsiniz.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1">
            <Label htmlFor="project-key">Anahtar</Label>
            <Input
              id="project-key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="percepta"
              className="font-mono text-sm"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="project-name">Görünen ad</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Percepta"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" disabled={mutation.isPending} onClick={handleSubmit}>
            Oluştur
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
