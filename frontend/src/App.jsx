import { Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import PreJoin from "./pages/PreJoin.jsx";
import Room from "./pages/Room.jsx";
import Notes from "./pages/Notes.jsx";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
       <Route path="/signup" element={<Signup />} /> 
      <Route path="/join/:code" element={<PreJoin />} />
      <Route path="/room/:code" element={<Room />} />
      <Route path="/notes/:code" element={<Notes />} />
    </Routes>
  );
}

export default App;