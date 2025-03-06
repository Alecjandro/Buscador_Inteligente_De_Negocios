import { BrowserRouter, Route, Router, Routes } from "react-router-dom";
import { Inicio } from "./componentes/login/inicio";
import Navbar from './componentes/Navbar/navbar';
import  Buscador from './componentes/busqueda/buscador';
function App() {
  return (
    //rutas
    <BrowserRouter>
      <Routes>
        <Route index element={<Inicio/>}/>
        <Route path="/inicio" element={<Inicio />} />
        <Route path="/busqueda" element={<><Navbar /><Buscador /></>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;