import { useNavigate } from "react-router-dom";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSpeechRecognition } from "@/lib/use-speech-recognition";
import { useSpeechSynthesis } from "@/lib/use-speech-synthesis";
import { cn } from "@/lib/utils";

interface VoiceQuickBarProps {
  /** Speak this text when TTS enabled and user taps speaker */
  speakText?: string;
  className?: string;
}

/** Compact voice in/out bar (V7 Faz 4). */
export function VoiceQuickBar({ speakText, className }: VoiceQuickBarProps) {
  const navigate = useNavigate();
  const speech = useSpeechRecognition({
    onFinal: (text) => {
      const q = text.trim();
      if (!q) return;
      navigate(`/chat?prompt=${encodeURIComponent(q)}`);
    },
  });
  const tts = useSpeechSynthesis();

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm",
        className
      )}
    >
      <span className="text-muted-foreground">Ses:</span>
      {speech.supported ? (
        <Button
          size="sm"
          variant={speech.listening ? "default" : "outline"}
          onClick={() => (speech.listening ? speech.stop() : speech.start())}
        >
          {speech.listening ? <MicOff className="mr-1 h-3 w-3" /> : <Mic className="mr-1 h-3 w-3" />}
          {speech.listening ? "Durdur" : "Konuş"}
        </Button>
      ) : (
        <span className="text-xs text-muted-foreground">Mikrofon desteklenmiyor</span>
      )}
      {tts.supported && (
        <>
          <Button size="sm" variant={tts.enabled ? "default" : "outline"} onClick={tts.toggle}>
            {tts.enabled ? <Volume2 className="mr-1 h-3 w-3" /> : <VolumeX className="mr-1 h-3 w-3" />}
            TTS
          </Button>
          {speakText && tts.enabled && (
            <Button size="sm" variant="ghost" onClick={() => tts.speak(speakText)}>
              Özeti oku
            </Button>
          )}
        </>
      )}
    </div>
  );
}
