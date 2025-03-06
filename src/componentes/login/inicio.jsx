import { FaUser, FaLock } from "react-icons/fa";
import styles from "./inicio.module.css"; // Cambiar la importación
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export const Inicio = () => {
  const navigate = useNavigate();
  const [isRegistering, setIsRegistering] = useState(false);
  const [credentials, setCredentials] = useState({
    email: "",
    password: "",
  });

  const [registerData, setRegisterData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const handleSignUpClick = () => {
    setIsRegistering(true);
  };

  const handleSignInClick = () => {
    setIsRegistering(false);
  };

  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({ ...prev, [name]: value }));
  };

  const handleRegisterChange = (e) => {
    const { name, value } = e.target;
    setRegisterData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLoginSubmit = (e) => {
    e.preventDefault();

    if (
      credentials.email === "usuario@ejemplo.com" &&
      credentials.password === "password123"
    ) {
      localStorage.setItem("isAuthenticated", "true");
      document.body.classList.add("logged-in");
      navigate("/busqueda");
    } else {
      alert("Credenciales incorrectas");
    }
  };

  const handleRegisterSubmit = (e) => {
    e.preventDefault();
    console.log("Datos de registro:", registerData);
    alert("Función de registro pendiente de implementar");
  };

  return (
    <div className={styles.inicio_page_container}>
    <div className={`${styles.inicio_container} ${isRegistering ? styles.active : ""}`}>
    <div
      className={`${styles.container} ${
        isRegistering ? styles.active : ""
      }`}
    >
      <div
        className={`${styles["logo-container"]} ${
          isRegistering ? styles["move-right"] : ""
        }`}
      >
        <img
          src="LogoVitrina.png"
          alt="Logo"
          className={styles["logo-image"]}
        />
      </div>

      <div className={styles["form-container"] + " " + styles["sign-up"]}>
        <form onSubmit={handleRegisterSubmit}>
          <h1>Crear cuenta</h1>
          <span>Ingresa los siguientes datos</span>
          <input
            type="text"
            placeholder="Nombre"
            name="name"
            value={registerData.name}
            onChange={handleRegisterChange}
          />
          <input
            type="email"
            placeholder="Email"
            name="email"
            value={registerData.email}
            onChange={handleRegisterChange}
          />
          <input
            type="password"
            placeholder="Contraseña"
            name="password"
            value={registerData.password}
            onChange={handleRegisterChange}
          />
          <button type="submit">Registrar</button>
        </form>
      </div>

      <div className={styles["form-container"] + " " + styles["sign-in"]}>
        <form onSubmit={handleLoginSubmit}>
          <h1>Iniciar sesión</h1>
          <span>Ingresa email y contraseña</span>
          <input
            type="email"
            placeholder="Email"
            name="email"
            value={credentials.email}
            onChange={handleLoginChange}
          />
          <input
            type="password"
            placeholder="Contraseña"
            name="password"
            value={credentials.password}
            onChange={handleLoginChange}
          />
          <button type="submit">Iniciar</button>
        </form>
      </div>

      <div className={styles["toggle-container"]}>
        <div className={styles["toggle"]}>
          <div className={styles["toggle-panel"] + " " + styles["toggle-left"]}>
            <h1>Bienvenido Administrador</h1>
            <p>
              Un potencial está esperando ser desbloqueado. ¡Hazlo realidad al
              crear una cuenta!
            </p>
            <button
              className={styles.hidden}
              onClick={handleSignInClick}
            >
              Iniciar sesión
            </button>
          </div>
          <div
            className={styles["toggle-panel"] + " " + styles["toggle-right"]}
          >
            <h1>Bienvenidos</h1>
            <p>Esta opción solo está disponible para usuario administrador</p>
            <button
              className={styles.hidden}
              onClick={handleSignUpClick}
            >
              Crear usuario
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  </div>
  );
};
