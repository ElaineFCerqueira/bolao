# Bolão Brasil x Marrocos

Projeto React + Vite + Tailwind + Firebase, pronto para deploy.

## Configuração já incluída
- Chave Pix: 71992790879
- Nome: Elaine Cerqueira
- Jogo: 13/06/2026 às 20h (palpites encerram às 19h)
- Firebase já configurado com suas credenciais

## Como rodar localmente
```bash
npm install
npm run dev
```

## Como fazer build de produção
```bash
npm install
npm run build
```
Os arquivos finais ficam na pasta `dist/`.

## Deploy mais fácil: Vercel
1. Crie uma conta em https://vercel.com (pode usar login do GitHub)
2. Suba este projeto para um repositório no GitHub
3. No Vercel, clique em "Add New Project", selecione o repositório
4. Framework Preset: Vite (detecta automaticamente)
5. Clique em "Deploy"
6. Em poucos segundos você recebe o link público para enviar aos amigos

## Deploy alternativo: Netlify
1. Crie conta em https://netlify.com
2. "Add new site" → "Import an existing project" → conecte o GitHub
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Deploy

## IMPORTANTE: Configurações pendentes no Firebase Console
Antes do site funcionar, no projeto "bolao-brasil-marrocos" no Firebase:

1. **Firestore Database**
   - Build → Firestore Database → Criar banco de dados → modo produção

2. **Regras do Firestore** (aba "Regras"), cole:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /artifacts/{appId}/public/data/palpites/{docId} {
      allow read: if true;
      allow create: if true;
      allow update, delete: if false;
    }
  }
}
```

3. **Authentication**
   - Build → Authentication → Sign-in method → habilitar provedor "Anônimo"

Sem esses 3 passos, o site carrega mas não consegue salvar/exibir os palpites.
