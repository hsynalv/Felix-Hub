import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getApiKey, requestUiToken, setApiKey } from "@/lib/auth";
import { useTheme } from "@/providers/ThemeProvider";
import { useToast } from "@/providers/ToastProvider";

export function SettingsPage() {
  const [key, setKey] = useState(() => getApiKey());
  const { theme, toggle } = useTheme();
  const toast = useToast();

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-lg font-semibold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Authentication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="password"
            placeholder="HUB API key / UI token"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setApiKey(key);
                toast.show("Key kaydedildi");
              }}
            >
              Kaydet
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  const { token } = await requestUiToken();
                  setKey(token);
                  setApiKey(token);
                  toast.show(`Token: ${token}`, "warn");
                } catch (e) {
                  toast.show(e instanceof Error ? e.message : "Hata", "error");
                }
              }}
            >
              Token al
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Token yalnızca localhost'tan alınabilir.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={toggle}>
            Tema: {theme === "dark" ? "Dark" : "Light"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Environment (Faz 4)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Dinamik env yönetimi Faz 4'te eklenecek. Şimdilik `.env` dosyasını kullanın.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
