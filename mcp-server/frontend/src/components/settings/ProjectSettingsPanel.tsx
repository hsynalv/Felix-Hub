import { FolderKanban } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingsInfoBox, SettingsSectionCard } from "@/components/settings/shared";
import { getProjectEnv, getProjectId, setProjectEnv, setProjectId } from "@/lib/settings-api";
import { useToast } from "@/providers/ToastProvider";

export function ProjectSettingsPanel() {
  const [projectId, setProjectIdState] = useState(() => getProjectId());
  const [projectEnv, setProjectEnvState] = useState(() => getProjectEnv());
  const toast = useToast();
  const queryClient = useQueryClient();

  const save = () => {
    setProjectId(projectId.trim() || "default");
    setProjectEnv(projectEnv.trim() || "development");
    toast.show("Proje ayarları kaydedildi");
    queryClient.invalidateQueries();
  };

  return (
    <SettingsSectionCard
      icon={FolderKanban}
      title="Proje"
      description="Hub'ın hangi proje ve ortam için çalışacağını tanımlar. Sohbet, bellek ve araç çağrıları bu bağlama göre yönlendirilir."
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Proje adı</Label>
            <Input
              value={projectId}
              onChange={(e) => setProjectIdState(e.target.value)}
              placeholder="default"
            />
            <p className="text-xs text-muted-foreground">Birden fazla proje yönetiyorsanız ayırt etmek için kullanın.</p>
          </div>
          <div className="space-y-2">
            <Label>Ortam</Label>
            <Select value={projectEnv} onValueChange={setProjectEnvState}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="development">Geliştirme</SelectItem>
                <SelectItem value="staging">Test</SelectItem>
                <SelectItem value="production">Canlı</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Geliştirme, test veya canlı ortam seçin.</p>
          </div>
        </div>

        <Button onClick={save}>Kaydet</Button>

        <SettingsInfoBox>
          Bu ayarlar yalnızca tarayıcınızda tutulur. Farklı bir cihazdan giriş yaptığınızda yeniden
          tanımlamanız gerekir.
        </SettingsInfoBox>
      </div>
    </SettingsSectionCard>
  );
}
