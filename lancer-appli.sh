#!/usr/bin/env bash
#
# Lance l'application Marées Perros-Guirec sous Linux (Ubuntu) ou macOS.
#
#   Depuis un terminal, dans le dossier du projet :
#       ./lancer-appli.sh
#
#   (au besoin, rendre le fichier exécutable une seule fois :
#        chmod +x lancer-appli.sh )
#
# Laisser la fenêtre du terminal ouverte : la fermer arrête l'application.

set -e

# Se placer dans le dossier app/, quel que soit l'endroit d'où on lance le script
cd "$(dirname "$0")/app"

# --- Vérifier que Node.js est installé ---
if ! command -v node >/dev/null 2>&1; then
  echo
  echo "  Node.js n'est pas installé."
  echo "  Installe-le, puis relance ce script :"
  echo
  echo "      sudo apt update && sudo apt install -y nodejs npm"
  echo
  echo "  (Node.js version 20.19 ou plus récente est nécessaire — voir https://nodejs.org)"
  echo
  read -r -p "  Appuie sur Entrée pour fermer."
  exit 1
fi

# --- Vérifier la version de Node (Vite 7 exige >= 20.19) ---
NODE_MAJOR=$(node -v | sed 's/v\([0-9]*\).*/\1/')
NODE_MINOR=$(node -v | sed 's/v[0-9]*\.\([0-9]*\).*/\1/')
if [ "$NODE_MAJOR" -lt 20 ] || { [ "$NODE_MAJOR" -eq 20 ] && [ "$NODE_MINOR" -lt 19 ]; }; then
  echo
  echo "  Node.js $(node -v) est trop ancien (il faut la version 20.19 ou plus récente)."
  echo "  Le plus simple sous Ubuntu :"
  echo
  echo "      curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
  echo "      sudo apt install -y nodejs"
  echo
  read -r -p "  Appuie sur Entrée pour fermer."
  exit 1
fi

# --- Installer les dépendances au premier lancement ---
if [ ! -d node_modules ]; then
  echo "  Premier lancement : installation des dépendances (patiente une minute)…"
  npm install
fi

echo
echo "  Démarrage de l'application Marées Perros-Guirec…"
echo "  (laisse cette fenêtre ouverte ; la fermer arrête l'application)"
echo

# Ouvre le navigateur tout seul après 4 s, le temps que le serveur démarre
( sleep 4; xdg-open http://localhost:3000 >/dev/null 2>&1 || true ) &

# Démarre le serveur (bloquant : occupe le terminal jusqu'à fermeture)
npm run dev
