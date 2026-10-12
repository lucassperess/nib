# Nib — contexto e direção de UI

## Direção visual atual — designs do Figma, 9 de outubro de 2026

O usuário desenhou as três telas principais (Home, Downloads e Histórico) e definiu essas composições como **referência visual mínima** para a próxima versão do frontend. Há arquivos separados para o logo e para os três fundos, com e sem o Nib; solicitar os originais quando forem necessários para implementação, sem reconstruir os desenhos a partir de capturas achatadas. As imagens compartilhadas nesta conversa mostram:

- **Home:** cena pixel art roxa noturna, wordmark Nib grande à esquerda, campo de link e escolha Vídeo/Áudio como ação central, Nib sobre o telhado à direita com fala curta, navegação discreta.
- **Downloads:** cenário de construção e pátio, fila de downloads em painel translúcido à esquerda, Nib à direita, fala ligada ao progresso e navegação discreta.
- **Histórico:** cenário interior amplo, tabela pesquisável e filtrável em painel translúcido à esquerda, Nib na parte inferior direita, navegação discreta.

A identidade agora é deliberadamente mais ilustrada e próxima de um mundo pixel art do que indicavam os wireframes anteriores. Esta direção mais recente prevalece sobre as restrições antigas que a tratavam apenas como detalhe atmosférico. O objetivo é manter a qualidade visual dessas telas ou superá-la, preservando legibilidade, controles utilizáveis e estados completos.

O Nib deve ser animado e conversar em frases curtas durante etapas reais do fluxo. As falas precisam corresponder ao estado da tarefa; progresso, erros e ações também devem aparecer em controles e texto acessíveis. Animações e balões não podem cobrir controles, cansar com repetição ou impedir uso com movimento reduzido.

### Animação e transições — decisão de 9 de outubro de 2026

- O Nib é um personagem ativo, animado por **sprites**, em camada independente dos fundos. O usuário deve perceber que ele participa da tarefa e se comunica durante todo o processo, não apenas receber um ícone de status que muda de expressão.
- Criar estados animados distintos ligados aos estágios reais: ocioso/atento, link recebido, analisando, preparando, baixando, processando/concluindo, sucesso e erro. Se houver espera, pausa, cancelamento ou retomada no fluxo implementado, esses estados também precisam de comportamento próprio. O estado visual, a fala e o status funcional devem permanecer sincronizados com o backend.
- Falas são breves, contextuais e não repetitivas. Elas podem dar personalidade à tarefa, enquanto porcentagem, etapas, erros e ações permanecem legíveis nos controles da interface. Definir regras de frequência, prioridade e interrupção para eventos simultâneos na fila.
- Na troca entre Home, Downloads e Histórico, o **fundo da cena atual apaga e o fundo da próxima cena se revela**, como uma transição de jogo. O conteúdo e os controles entram em sequência coerente com a nova cena; a navegação não deve parecer um corte de página web. Evitar transição longa que atrase operações repetidas.
- Prototipar a transição com os fundos originais separados, preferencialmente sem o Nib, para animar personagem e cenário de modo independente. As imagens finais e sprites serão fornecidos pelo usuário; não inferir quadros de animação a partir das capturas achatadas.
- Prever versão com movimento reduzido que mantenha a mesma mudança de estado por um fade curto e direto, sem perder informações.

As três páginas principais continuam Home, Downloads e Histórico. Configurações é área secundária. O protótipo técnico confirmou o motor Cobalt local e a versão instalada já concluiu downloads reais.

### Arquivos visuais recebidos

Em 9 de outubro de 2026, o usuário enviou os sete PNGs de cenário e marca. Os originais recebidos permanecem na raiz do workspace (`p1`, `p1nib`, `p2`, `p2-nib`, `p3`, `p3-nib`, `nib-logo-font`), e cópias com extensão `.png` estão organizadas para implementação:

| Página | Fundo sem personagem, para a cena | Com personagem, referência de posição |
| --- | --- | --- |
| Home | `assets/backgrounds/home.png` (1619 × 972) | `assets/backgrounds/home-with-nib-reference.png` (1619 × 971) |
| Downloads | `assets/backgrounds/downloads.png` (1672 × 941) | `assets/backgrounds/downloads-with-nib-reference.png` (1672 × 941) |
| Histórico | `assets/backgrounds/history.png` (1672 × 941) | `assets/backgrounds/history-with-nib-reference.png` (1672 × 941) |

Logo: `assets/branding/nib-wordmark.png` (1983 × 793, com transparência). As imagens com personagem são composições de referência, **não** sprite sheets. O protótipo usa `assets/sprites/nib-states-v1.png`, um atlas separado com poses por estado; ainda é preciso revisar e ampliar os quadros para atingir a animação expressiva desejada. A Home tem diferença de 1 px na altura entre as duas versões, então alinhar pelo enquadramento visual ao comparar ou transicionar.

### O que validar na passagem de design para produto

- Contraste e leitura dos textos pequenos sobre fundos ricos em detalhes, especialmente fila, tabela e navegação.
- Resposta a redimensionamento da janela, escalas de tela e proporções diferentes das capturas em laptop.
- Estados reais: URL inválida, link não suportado, seleção de vários itens, progresso sem percentual confiável, pausa/cancelamento/erro/conclusão, lista vazia e histórico longo.
- Posição, tamanho e falas do Nib em cada página e em janelas menores.
- Peso das imagens e animações para manter o aplicativo responsivo.

Fonte de produto e mascote: briefing privado de design do Nib. As notas abaixo registram a direção anterior, de 5 de outubro de 2026, e servem como histórico de decisões; os designs do Figma acima são a referência visual atual.

## Produto

Nib é uma pequena ferramenta desktop para capturar e baixar mídia a partir de links. O fluxo principal é: colar ou arrastar um link → analisar a fonte → mostrar mídia e formatos encontrados → escolher → adicionar à fila → baixar/processar → abrir o arquivo. Downloads, History e Settings completam o MVP. O histórico guarda metadados locais; o arquivo fica no destino escolhido pelo usuário.

O mascote Nib é um morcego roxo compacto e expressivo. Ele comunica estados do produto por postura, asas, orelhas e movimento. A interface precisa continuar plenamente utilizável mesmo quando o usuário ignora o mascote. Ele nunca substitui informações ou controles essenciais.

## Direção anterior da interface

Nib deve parecer uma ferramenta desktop indie para devs e usuários técnicos: escura, minimalista, silenciosa e um pouco estranha, com personalidade própria. A UI principal é moderna e limpa. Não deve virar terminal, jogo ou dashboard SaaS.

- **OpenCode:** referência principal de estrutura. Foco na tarefa, muito espaço negativo, composição simples e hierarquia próxima à de uma ferramenta de desenvolvedor. A Home gira em torno de colar ou arrastar um link.
- **Hermes:** referência de aplicativo desktop maduro. Orienta a organização de Downloads, History e Settings, com conteúdo amplo, navegação compacta e titlebar integrada.
- **Codex mini:** referência de comportamento do mascote. Nib fica pequeno e persistente no canto inferior direito; reage a hover, aceita links arrastados, comunica estados e abre um quick panel ao clique.
- **Pixel art roxa e jogos indie:** referência atmosférica. Influencia tons, clima, mascote, microdetalhes e motion. A interface inteira não deve ser pixelizada.
- **Catppuccin Mocha:** referência para a lógica de cores, não um tema a copiar. Base quase preta/azulada, superfícies cinza-roxo, texto claro e acentos mauve, lavanda e azul; a paleta final deve ser própria do Nib.

O caráter indie vem de microcopy curta e humana, uso seletivo de mono, símbolos próprios, motion econômico e o mascote integrado à experiência.

## Layout acordado

- Titlebar integrada.
- Navigation rail compacta em vez de sidebar larga.
- **Focus mode:** Home, Analyze e Result, com muito respiro e ação principal evidente.
- **Workspace mode:** Downloads, History e Settings, com maior densidade operacional.
- Nib ancorado ao canto inferior direito, com área de interação clara, sem cobrir controles importantes e abaixo de modais.
- Home é a tela mais vazia; Downloads e History podem ser mais densos.

## Próxima etapa: wireframes

Criar wireframes low fidelity genuínos antes do high fidelity: **monocromáticos, uma tela por imagem, sem glow, sem paleta final e sem mascote refinado**. Validar apenas hierarquia, espaçamento, navegação, posição do Nib, densidade e fluxo. Depois vêm identidade roxa, tipografia final e motion.

Telas e fluxos prioritários do documento: Home vazia; link recebido e Analyze; Result com formatos; Downloads em andamento e concluído; History; Settings básico; quick panel; erro de URL ou fonte não suportada; seleção de múltiplas mídias. Os fluxos críticos incluem colar link, selecionar melhor qualidade, baixar, corrigir URL inválida, lidar com fonte não suportada e arrastar link até Nib.

## Referências visuais fornecidas

Referências usadas na exploração privada de design (não distribuídas no repositório público):

1. `codex-mini.png` — posição e presença discreta do companion no canto inferior direito.
2. `opencode.png` — foco, espaço negativo e hierarquia de devtool.
3. `hermes-workspace.png` — organização de tela operacional desktop.
4. `hermes-home.jpg` — Home ampla, titlebar e navegação.
5. `indie-atmosphere.png` — clima noturno roxo e pixel art.
6. `indie-game.png` — atmosfera e detalhe visual de jogo indie.
7. `nib-icon-concept.png` — conceito inicial do morcego no Notion.
8. `nib-concept-board.png` — exploração inicial de marca, paleta, estados e telas no Notion. Serve como referência de direção futura; não define o visual dos wireframes low fidelity.

As imagens são referências com funções distintas, não telas a copiar. A síntese mais recente da UI prevalece sobre eventuais propostas anteriores do documento do Notion, especialmente na decisão de começar por wireframes monocromáticos.
