# Tasks
Technologies Mena's
sudo chown -R $USER:$USER .git
chmod -R u+rw .git



 mongodb atlas ydrmena27@gmail.com
 
Instala node js
sudo apt install nodejs
node -v

Install curl
sudo apt install curl
curl --version

Install NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
command -v nvm
Cerrar terminal e iniciar de nuevo

NVM descargará y gestionará de manera limpia esa misma versión la version actual
nvm install v22.22.1
nvm alias default v22.22.1

Desinstale la versión del sistema
Una vez que NVM ya tenga su propia copia de la versión 22, puede eliminar la versión del sistema sin miedo a perder nada.
sudo apt remove nodejs npm
sudo apt autoremove

nvm install 22
nvm alias default 22
node -v

Levantar el Backend (Node.js)
Abre tu terminal y navega hasta la carpeta del backend:

cd ~/Projects/Tasks/task-list-backend
Instala las dependencias declaradas en tu package.jsonpara asegurarte de que no falte nada:
npm install














