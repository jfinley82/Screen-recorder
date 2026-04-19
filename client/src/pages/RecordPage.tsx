import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, MicOff, Camera, CameraOff } from "lucide-react";
import { useScreenRecorder } from "@/hooks/useScreenRecorder";
import { useUpload } from "@/hooks/useUpload";
import { SizePresetPicker } from "@/components/recorder/SizePresetPicker";
import { WebcamControls, WebcamPreview } from "@/components/recorder/WebcamBubble";
import { RecordingControls } from "@/components/recorder/RecordingControls";
import { SIZE_PRESETS, type SizePreset, type WebcamPosition, type WebcamSize, type WebcamShape } from "~/types";
import { cn } from "@/lib/utils";

export default function RecordPage() {
  const navigate = useNavigate();
  const [preset, setPreset] = useState<SizePreset>(SIZE_PRESETS[0]);
  const [webcamEnabled, setWebcamEnabled] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [webcamPosition, setWebcamPosition] = useState<WebcamPosition>("bottom-right");
  const [webcamSize, setWebcamSize] = useState<WebcamSize>("md");
  const [webcamShape, setWebcamShape] = useState<WebcamShape>("circle");

  const recorder = useScreenRecorder();
  const { upload, uploadState, progress } = useUpload();

  const canvasPreviewRef = recorder.previewRef as React.RefObject<HTMLCanvasElement>;
  const webcamVideoRef = recorder.webcamRef as React.RefObject<HTMLVideoElement>;

  const handleStart = async () => {
    await recorder.start({
      preset,
      webcamEnabled,
      micEnabled,
      webcamPosition,
      webcamSize,
      webcamShape,
    });
  };

  const handleDone = async () => {
    if (!recorder.blob) return;
    const id = await upload(recorder.blob, "Untitled Recording");
    if (id) {
      recorder.reset();
      navigate(`/editor/${id}`);
    }
  };

  const isActive = recorder.state === "recording" || recorder.state === "paused";

  return (
    <div className="flex h-full">
      {/* Settings panel */}
      <div className={cn(
        "w-72 border-r border-border p-5 space-y-6 overflow-y-auto shrink-0 transition-opacity",
        isActive && "opacity-50 pointer-events-none"
      )}>
        <div>
          <h2 className="font-semibold mb-4">Recording Setup</h2>
          <SizePresetPicker value={preset} onChange={setPreset} />
        </div>

        {/* Toggles */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Audio & Camera</p>
          <button
            onClick={() => setMicEnabled((v) => !v)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors text-sm font-medium",
              micEnabled ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary text-foreground"
            )}
          >
            {micEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            {micEnabled ? "Microphone On" : "Microphone Off"}
          </button>
          <button
            onClick={() => setWebcamEnabled((v) => !v)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors text-sm font-medium",
              webcamEnabled ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary text-foreground"
            )}
          >
            {webcamEnabled ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
            {webcamEnabled ? "Camera On" : "Camera Off"}
          </button>
        </div>

        {/* Webcam options */}
        <WebcamControls
          enabled={webcamEnabled}
          position={webcamPosition}
          size={webcamSize}
          shape={webcamShape}
          onPositionChange={setWebcamPosition}
          onSizeChange={setWebcamSize}
          onShapeChange={setWebcamShape}
        />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 min-w-0">
        {recorder.state === "idle" && (
          <div className="text-center space-y-3">
            <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto">
              <div className="w-10 h-10 rounded-full bg-red-500" />
            </div>
            <h1 className="text-2xl font-semibold">Ready to Record</h1>
            <p className="text-muted-foreground">
              {preset.label} · {preset.width}×{preset.height}
              {webcamEnabled ? " · Camera On" : ""}
              {micEnabled ? " · Mic On" : ""}
            </p>
          </div>
        )}

        {/* Live canvas preview — always mounted so previewRef is never null */}
        <div className={cn(
          "relative w-full max-w-3xl rounded-xl overflow-hidden border border-border shadow-lg bg-black",
          !isActive && "hidden"
        )}>
          <canvas
            ref={canvasPreviewRef}
            className="w-full"
            style={{ aspectRatio: preset.aspectRatio }}
          />
          {webcamEnabled && (
            <WebcamPreview
              videoRef={webcamVideoRef}
              shape={webcamShape}
              size={webcamSize}
            />
          )}
        </div>

        {/* Done state — upload */}
        {recorder.state === "done" && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto">
              <div className="w-8 h-8 rounded-full bg-green-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Recording Complete</h2>
              <p className="text-muted-foreground text-sm">
                {Math.round(recorder.duration / 60)}m {recorder.duration % 60}s recorded
              </p>
            </div>

            {uploadState === "idle" && (
              <div className="flex gap-3 justify-center">
                <button
                  onClick={recorder.reset}
                  className="px-4 py-2 rounded-lg border border-border hover:bg-secondary text-sm font-medium"
                >
                  Discard
                </button>
                <button
                  onClick={handleDone}
                  className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
                >
                  Upload & Edit
                </button>
              </div>
            )}

            {(uploadState === "uploading" || uploadState === "ingesting") && (
              <div className="w-64 space-y-2 mx-auto">
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  {uploadState === "uploading" ? `Uploading… ${progress}%` : "Processing with Mux…"}
                </p>
              </div>
            )}
          </div>
        )}

        {recorder.error && (
          <p className="text-sm text-red-500 bg-red-50 px-4 py-2 rounded-lg">{recorder.error}</p>
        )}

        {/* Controls */}
        <RecordingControls
          state={recorder.state}
          duration={recorder.duration}
          onStart={handleStart}
          onPause={recorder.pause}
          onResume={recorder.resume}
          onStop={recorder.stop}
        />
      </div>
    </div>
  );
}
