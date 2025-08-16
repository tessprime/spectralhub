import { useState } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/core";
import { MicrophoneSelector } from "./components/MicrophoneSelector";
import { AudioSpectrum } from "./components/AudioSpectrum";
import "./App.css";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");
  const [selectedMicrophone, setSelectedMicrophone] = useState("");

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name }));
  }

  return (
    <main className="container">
      <MicrophoneSelector
        selectedMicrophone={selectedMicrophone}
        onMicrophoneChange={setSelectedMicrophone}
      />
      
      <AudioSpectrum selectedMicrophone={selectedMicrophone} />
    </main>
  );
}

export default App;
