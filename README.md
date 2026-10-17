# Brodemy

App (PWA) de controle de treinos: **Academia, Street e Calistenia**.
Funciona offline, instala no Android como app e guarda tudo num banco de dados embutido no celular.

## Funcionalidades

- **Projetos de progressão**: vários projetos ativos ao mesmo tempo, cada um com nome, objetivos, foto do dia 1, foto final e feedback ao encerrar. Encerrar não apaga nada: dá para reabrir ou criar um novo projeto copiando o plano.
- **Plano semanal por projeto**: cada dia (seg–dom) tem nome do treino, tipo (Academia/Street/Calistenia/Outro), anotações, vídeos e links de referência, e a lista de exercícios.
- **Vídeos**: links do YouTube (incluindo Shorts) tocam dentro do app. Também aceita vídeo da galeria ou link direto `.mp4`. Outros links abrem no navegador.
- **Exercícios**: nome, equipamento, **foto do equipamento**, meta (ex.: 4x10-12), descanso padrão e quais campos registrar.
- **Registro do treino**: séries ilimitadas, adicionadas conforme você executa. Todos os campos são opcionais: carga, repetições, tempo, distância, descanso e observação. Cada nova série copia os valores da anterior.
- **Timer de descanso**: ▶ em cada série, com contagem regressiva, ±15s, pausa, som e vibração. A tela fica acesa durante o treino.
- **Último treino**: cada exercício mostra o que você fez da última vez.
- **Foto de progresso ao finalizar o treino** (opcional). Usa o **app de câmera nativo** do celular.
- **Fotos**: galeria por projeto, com comparação lado a lado de duas datas.
- **Evolução**: frequência semanal, carga máxima, 1RM estimada, volume, repetições, tempo e distância por exercício, com variação % e recorde.
- **Relatórios CSV**: séries (detalhado), treinos (resumo) e projetos. Usa separador `;` e abre no Excel ou no Google Planilhas.
- **Backup**: exporta e restaura todos os dados, incluindo fotos e vídeos, num arquivo `.json`.

## Onde ficam os dados

Os dados ficam no **IndexedDB** (banco de dados embutido do navegador/app), via [Dexie](https://dexie.org). O app pede *armazenamento persistente* para o Android não apagar os dados. Desinstalar o app ou limpar os dados do site no Chrome apaga tudo, então use **Ajustes → Exportar cópia de segurança** de vez em quando.

## Desenvolvimento

```bash
npm install
npm run dev        # servidor de desenvolvimento (http://localhost:5173)
npm run build      # gera a versão final em dist/
npm run preview    # serve o dist/ em http://localhost:4173
npm run icons      # regenera os ícones a partir de public/logo.svg
```

Stack: React 18 + TypeScript + Vite + vite-plugin-pwa (service worker/offline) + Dexie (IndexedDB) + lucide-react (ícones).

## Instalar no Android

Um PWA só pode ser instalado quando servido por **HTTPS**. Publique a pasta `dist/` em qualquer hospedagem estática gratuita:

- **Netlify Drop**: rode `npm run build` e arraste a pasta `dist/` em <https://app.netlify.com/drop>.
- **GitHub Pages / Vercel / Cloudflare Pages**: publique o conteúdo de `dist/`. O app usa caminhos relativos e funciona em subpastas.

Depois, no celular:

1. Abra o endereço no **Chrome**.
2. Menu ⋮ → **Instalar app** (ou "Adicionar à tela inicial").
3. O Brodemy aparece na lista de apps e abre em tela cheia, funcionando offline.

> Importante: os dados ficam ligados ao endereço (domínio). Mantenha sempre o mesmo endereço. Se for trocar de endereço, exporte o backup antes e restaure no novo.

## Estrutura

```
src/
  db.ts                 # schema do banco (projetos, plano, treinos, séries, fotos, arquivos)
  lib/repo.ts           # operações de dados (criar projeto, iniciar/finalizar treino…)
  lib/stats.ts          # cálculos de evolução
  lib/csv.ts            # relatórios CSV
  lib/backup.ts         # exportar/restaurar backup
  components/           # timer, vídeos, gráficos, editor de exercício, UI
  pages/                # Hoje, Projetos, Projeto, Dia, Treino, Histórico, Evolução, Ajustes
```
