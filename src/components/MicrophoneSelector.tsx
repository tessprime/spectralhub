import { useState, useEffect } from "react";

interface MicrophoneSelectorProps {
  selectedMicrophone: string;
  onMicrophoneChange: (deviceId: string) => void;
}

interface MediaDeviceInfo {
  deviceId: string;
  label: string;
}

export function MicrophoneSelector({ selectedMicrophone, onMicrophoneChange }: MicrophoneSelectorProps) {
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getMicrophones = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices
          .filter(device => device.kind === 'audioinput')
          .map(device => ({
            deviceId: device.deviceId,
            label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`
          }));
        
        setMicrophones(audioInputs);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to access microphones');
      } finally {
        setIsLoading(false);
      }
    };

    getMicrophones();
  }, []);

  if (isLoading) {
    return <div>Loading microphones...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <label htmlFor="microphone-select">Select Microphone:</label>
      <select
        id="microphone-select"
        value={selectedMicrophone}
        onChange={(e) => onMicrophoneChange(e.target.value)}
      >
        {microphones.map((mic) => (
          <option key={mic.deviceId} value={mic.deviceId}>
            {mic.label}
          </option>
        ))}
      </select>
    </div>
  );
}