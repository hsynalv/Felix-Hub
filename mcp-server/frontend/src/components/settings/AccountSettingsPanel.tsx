import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { KeyRound, User } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { changePassword, updateProfile } from "@/lib/auth";
import { SettingsInfoBox, SettingsSectionCard, SecretInput } from "@/components/settings/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/providers/ToastProvider";

export function AccountSettingsPanel() {
  const toast = useToast();
  const { user, mode } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const profileMut = useMutation({
    mutationFn: () => updateProfile(displayName.trim()),
    onSuccess: () => toast.show("Profil güncellendi"),
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const passwordMut = useMutation({
    mutationFn: () => {
      if (newPassword !== confirmPassword) {
        throw new Error("Yeni şifreler eşleşmiyor");
      }
      return changePassword(currentPassword, newPassword);
    },
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.show("Şifre değiştirildi");
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  if (mode !== "session" || !user) {
    return (
      <SettingsInfoBox variant="tip" title="Oturum hesabı gerekli">
        Ad ve şifre yönetimi yalnızca e-posta ile giriş yaptığınızda kullanılabilir. API anahtarı modunda
        hesap ayarları burada görünmez.
      </SettingsInfoBox>
    );
  }

  return (
    <div className="space-y-6">
      <SettingsSectionCard
        icon={User}
        title="Profil"
        description="Görünen adınız arayüzde ve bildirimlerde kullanılır."
      >
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>E-posta</Label>
            <Input value={user.email} disabled className="bg-muted/40" />
          </div>
          <div className="space-y-1">
            <Label>Görünen ad</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={() => profileMut.mutate()} disabled={!displayName.trim() || profileMut.isPending}>
            Profili kaydet
          </Button>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
        icon={KeyRound}
        title="Şifre"
        description="Güvenlik için mevcut şifrenizi doğrulayın. Yeni şifre en az 8 karakter olmalı."
      >
        <div className="mt-4 grid max-w-lg gap-4">
          <div className="space-y-1">
            <Label>Mevcut şifre</Label>
            <SecretInput value={currentPassword} onChange={setCurrentPassword} />
          </div>
          <div className="space-y-1">
            <Label>Yeni şifre</Label>
            <SecretInput value={newPassword} onChange={setNewPassword} />
          </div>
          <div className="space-y-1">
            <Label>Yeni şifre (tekrar)</Label>
            <SecretInput value={confirmPassword} onChange={setConfirmPassword} />
          </div>
        </div>
        <div className="mt-4">
          <Button
            variant="secondary"
            onClick={() => passwordMut.mutate()}
            disabled={!currentPassword || !newPassword || passwordMut.isPending}
          >
            Şifreyi değiştir
          </Button>
        </div>
      </SettingsSectionCard>
    </div>
  );
}
