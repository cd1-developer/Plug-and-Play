import React from "react";
import { PeerContext } from "@/hooks/Peer/PeerProvider";

export const usePeer = () => {
  const context = React.useContext(PeerContext);

  if (!context) {
    throw new Error("use peer must be inside PeerProvider");
  }
  return context;
};
