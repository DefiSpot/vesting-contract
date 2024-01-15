import React from "react";
import ReactDOM from "react-dom";
import { Dapp } from "./components/Dapp";

// We import bootstrap here, but you can remove if you want
import "bootstrap/dist/css/bootstrap.css";

// This is the entry point of your application, but it just renders the Dapp
// react component. All of the logic is contained in it.

ReactDOM.render(
  <React.StrictMode>
    <Dapp />
  </React.StrictMode>,
  document.getElementById("root")
);

/*import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "bootstrap/dist/css/bootstrap.css";
//import App from "./App";
import { Dapp } from "./components/Dapp";

const rootElement = document.getElementById("root");
const root = createRoot(rootElement);

root.render(
  <StrictMode>
    <Dapp />
  </StrictMode>
);*/
