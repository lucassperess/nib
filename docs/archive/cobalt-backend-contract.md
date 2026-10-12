# Nib — contrato de UX para o backend cobalt

Pesquisa de referência em 5 de outubro de 2026. Fontes primárias: [API do cobalt](https://github.com/imputnet/cobalt/blob/main/docs/api.md), [configurações do cobalt](https://cobalt.tools/settings/video), [processamento local](https://cobalt.tools/settings/local), [remux](https://cobalt.tools/remux), [instâncias](https://cobalt.tools/settings/instances).

Este documento registra a pesquisa e as decisões de UX anteriores à implementação. Para o estado atual do aplicativo, veja o [README](../../README.md) e a [matriz histórica de validação](test-matrix-0.1.md).

Investigação posterior do repositório oficial: [cobalt-github-investigation.md](cobalt-github-investigation.md). O parâmetro `localProcessing` da API determina se o **cliente** faz merge/conversão; ele não significa que a instância da API roda na máquina do usuário. A escolha de hospedar a API localmente ou numa VPS é independente desse parâmetro.

## Direção do produto confirmada

- Nib é um aplicativo desktop com o Cobalt empacotado e executado na máquina do usuário, ligado apenas a `127.0.0.1`. Não exige VPS nem pede URL de instância remota.
- A etapa **Set your preferences** permanece no fluxo. A Home reserva um wordmark pixelado monocromático, ainda sem acabamento de marca.
- O Histórico armazena apenas downloads concluídos. Seus filtros são por tipo de mídia: todos, vídeo, áudio e imagem. Falhas e cancelamentos ficam na fila.
- A ferramenta de remux continua como função secundária, mas a UI usa linguagem amigável, como **Convert a file**; deve explicar que cria uma cópia compatível preservando o original e, quando aplicável, a qualidade.

## Capacidades documentadas

- A API principal recebe uma URL e preferências em `POST /`. Os tipos de resposta documentados são `tunnel`, `redirect`, `local-processing`, `picker` e `error`.
- `picker` contém itens individuais com tipo, URL e thumbnail opcional. Não é um catálogo geral de codecs, resoluções, duração e tamanho para toda URL.
- `local-processing` descreve tarefas como merge, mute, audio, gif e remux, além de dados de saída e túneis. A fila e o progresso detalhado são recursos do cliente cobalt, não uma fila de downloads persistente oferecida pela API como serviço.
- A resposta de arquivo pode ter nome; tamanho final exato não é garantido. `Estimated-Content-Length` é apenas uma estimativa e não serve para verificação estrita.
- A API permite preferências de qualidade de vídeo, codec/container do YouTube, modo de download, formato/bitrate de áudio, idioma de legenda, idioma de dublagem do YouTube, som original do TikTok, metadata, estilo de nome, proxy/túnel e processamento local.
- A API pública hospedada pelo cobalt usa proteção contra bots e não é destinada a outros projetos sem permissão. O Nib deve usar o motor local previsto para o aplicativo desktop.

## Implicações para o fluxo

1. **Uma URL, uma solicitação.** A Home recebe o link. Uma etapa leve de preferências, antes de enviar a solicitação, permite escolher vídeo/áudio e qualidade preferida. O backend pode escolher a melhor alternativa disponível quando a preferência não existir.
2. **Não prometer catálogo inexistente.** O Nib só deve mostrar título, duração, thumbnail, resolução final, tamanho ou formatos alternativos quando realmente os tiver. Não inventar uma lista de formatos antes da resposta do cobalt.
3. **Resposta ramificada.** `picker` leva a seleção de múltiplas mídias. `tunnel`/`redirect` levam à transferência ou confirmação de salvamento. `local-processing` leva a download + processamento local com etapas. `error` leva a feedback específico.
4. **Resultado honesto.** Diferenciar qualidade *preferida* da qualidade *obtida*. Indicar quando áudio é fluxo original ou convertido. Mostrar tamanho estimado como estimativa e progresso indeterminado quando não houver total confiável.
5. **Fila própria do Nib.** Se houver múltiplos downloads, retomada após reiniciar, histórico e ações de cancelamento, o app desktop precisará gerenciar essas tarefas e seus estados; isso não vem pronto do endpoint da API.
6. **Privacidade.** O documento do Nib prevê History local com URL, título e caminho. Deixar explícito o que fica no dispositivo e oferecer apagar item/limpar histórico. O motor local ainda acessa as fontes de mídia pela internet.
7. **Conversão de arquivo.** O cobalt oferece remux local de arquivos existentes sem recodificar. No Nib, essa utilidade secundária deve ser apresentada com linguagem comum e explicação das suas limitações; não deve poluir a Home principal.

## Mapeamentos que exigem atenção

| Intenção do Nib | Parâmetro/capacidade documentada |
| --- | --- |
| Melhor qualidade de vídeo disponível | `videoQuality: "max"`; a API pode usar alternativa se indisponível |
| Áudio no formato original quando possível | `audioFormat: "best"`; o default documentado da API é `mp3`, que pode converter |
| Apenas áudio | `downloadMode: "audio"` |
| Silenciar vídeo | `downloadMode: "mute"` |
| Legenda preferida | `subtitleLang` |
| Preferir faixa dublada no YouTube | `youtubeDubLang` |
| Áudio original no TikTok | `tiktokFullAudio` |
| Solicitar processamento local | `localProcessing: "preferred"` ou `"forced"`, sujeito à instância |

## Possível evolução

Se a escolha prévia entre **todos os formatos exatos** for indispensável, o Nib precisará de uma camada de descoberta adicional, separada do contrato geral documentado do cobalt. O MVP dos wireframes deve trabalhar com preferências antes da solicitação e confirmação do resultado real depois. Essa direção pode ser revista quando houver protótipo técnico da integração.
