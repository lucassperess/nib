# Investigação do GitHub do Cobalt para o Nib

Consulta em 9 de outubro de 2026 ao repositório oficial `imputnet/cobalt`, commit [`a636575b`](https://github.com/imputnet/cobalt/tree/a636575b09de1fc55d9b8cd98cac88f5f2f16b42). Este documento separa capacidades observadas de decisões propostas para o Nib.

## Conclusão

O Cobalt é uma boa base para **resolver links e obter/transformar mídia**. O Nib deve ter frontend, orquestrador de downloads, histórico e lógica do mascote próprios. O primeiro protótipo deve tentar executar a API como processo local em Windows, ligada somente a `127.0.0.1`, antes de escolher VPS. O repositório documenta execução fora do Docker para desenvolvimento, mas não entrega um empacotamento desktop Windows pronto.

## Estrutura e licenças

- O monorepo contém `api/`, `web/` e `packages/`. A API é Node/Express; o frontend é SvelteKit/Vite. [README do repositório](https://github.com/imputnet/cobalt/blob/a636575b09de1fc55d9b8cd98cac88f5f2f16b42/README.md), [README da API](https://github.com/imputnet/cobalt/blob/a636575b09de1fc55d9b8cd98cac88f5f2f16b42/api/README.md), [README web](https://github.com/imputnet/cobalt/blob/a636575b09de1fc55d9b8cd98cac88f5f2f16b42/web/README.md).
- **API:** AGPL-3.0. Usar/modificar/distribuir esse código exige atenção às obrigações de atribuição e disponibilização de código previstas pela licença. **Web:** CC-BY-NC-SA-4.0, com proibição expressa de uso comercial do código; branding e mascotes do Cobalt não estão cobertos para reutilização em um produto alternativo. Não copiar a interface web nem seus assets para o Nib. [Licença API](https://github.com/imputnet/cobalt/blob/a636575b09de1fc55d9b8cd98cac88f5f2f16b42/api/README.md#license), [licença web](https://github.com/imputnet/cobalt/blob/a636575b09de1fc55d9b8cd98cac88f5f2f16b42/web/README.md#license). Uma revisão jurídica é necessária antes de distribuir um produto que incorpore ou modifique o código da API, especialmente se houver modelo comercial.
- `packages/api-client` contém apenas configuração de pacote/licença, sem implementação de cliente nesta revisão. Integrar pelo contrato HTTP documentado. [Árvore do pacote](https://github.com/imputnet/cobalt/tree/a636575b09de1fc55d9b8cd98cac88f5f2f16b42/packages/api-client).

## O que a API entrega

- `POST /` recebe uma URL e preferências: vídeo/áudio, qualidade, codec/container, formato/bitrate de áudio, legendas e outras opções. É **uma solicitação que retorna a forma de obter a mídia**, não um job duradouro com eventos de progresso. [API](https://github.com/imputnet/cobalt/blob/a636575b09de1fc55d9b8cd98cac88f5f2f16b42/docs/api.md#post).
- Respostas possíveis: `redirect` (URL direta), `tunnel` (fluxo por proxy/processamento), `local-processing` (URLs de fluxos e instruções para o cliente combinar/converter), `picker` (itens separados em posts com várias mídias) e `error`. [Tipos de resposta](https://github.com/imputnet/cobalt/blob/a636575b09de1fc55d9b8cd98cac88f5f2f16b42/docs/api.md#response).
- A resposta `picker` pode conter tipo, URL e thumbnail opcional dos itens. Não é um catálogo universal de formatos, resolução, tamanho e duração antes de baixar. Metadados de mídia e nomes ricos variam por serviço. [Picker](https://github.com/imputnet/cobalt/blob/a636575b09de1fc55d9b8cd98cac88f5f2f16b42/docs/api.md#picker-response), [matriz de serviços](https://github.com/imputnet/cobalt/blob/a636575b09de1fc55d9b8cd98cac88f5f2f16b42/api/README.md#supported-services).
- O fluxo pode oferecer `Content-Length` exato ou `Estimated-Content-Length` estimado. O Nib deve mostrar progresso indeterminado quando não tiver total confiável e não usar estimativa como verificação de integridade. [GET /tunnel](https://github.com/imputnet/cobalt/blob/a636575b09de1fc55d9b8cd98cac88f5f2f16b42/docs/api.md#get-tunnel).
- Instâncias públicas do Cobalt não se destinam a integração por outros projetos sem permissão. O Nib precisará de instância própria, local ou hospedada. [Aviso da API](https://github.com/imputnet/cobalt/blob/a636575b09de1fc55d9b8cd98cac88f5f2f16b42/docs/api.md#cobalt-api-documentation).

## O que o Nib precisa construir

| Recurso do Nib | Situação no Cobalt | Trabalho do Nib |
| --- | --- | --- |
| Home com escolha Vídeo/Áudio | Preferências no `POST /` | UX, validação e mapeamento de preferências |
| Fila em Downloads | O frontend web tem fila própria, em store Svelte e scheduler serial | Fila desktop persistente, cancelamento, retomada possível e política de concorrência |
| Progresso | Fluxos HTTP e processamento geram sinais; API não emite estado contínuo de job | Medir bytes, etapas e processamento no orquestrador; alimentar UI e sprites |
| Histórico | Não há histórico desktop fornecido pela API | Salvar metadados e caminho local após conclusão, busca, filtros e limpeza |
| Arquivo final | Frontend web usa download do navegador e armazenamento temporário para processamento | Gravar diretamente no destino escolhido, conferir conclusão e abrir arquivo/pasta |
| Nib animado | Não existe personagem/contrato de eventos do Nib | Máquina de estados que traduz eventos reais para sprites e falas |

Evidência para a fila web: [store da fila](https://github.com/imputnet/cobalt/blob/a636575b09de1fc55d9b8cd98cac88f5f2f16b42/web/src/lib/state/task-manager/queue.ts), [scheduler](https://github.com/imputnet/cobalt/blob/a636575b09de1fc55d9b8cd98cac88f5f2f16b42/web/src/lib/task-manager/scheduler.ts), [tratamento das respostas](https://github.com/imputnet/cobalt/blob/a636575b09de1fc55d9b8cd98cac88f5f2f16b42/web/src/lib/api/saving-handler.ts). O store começa vazio em memória; a implementação consultada não fornece persistência de fila/histórico entre sessões. Além disso, `redirect` e `tunnel` são entregues ao mecanismo de download do navegador, enquanto `local-processing` entra na fila de processamento web. Não usar essa fila como solução pronta para a tela Downloads do Nib.

## Local, VPS e a ambiguidade de `localProcessing`

- A API pode rodar fora do Docker para desenvolvimento com Node, pnpm e `API_URL=http://localhost:9000/`. A documentação recomenda Docker Compose para instâncias convencionais. [Guia de instalação](https://github.com/imputnet/cobalt/blob/a636575b09de1fc55d9b8cd98cac88f5f2f16b42/docs/run-an-instance.md).
- Para um app local, configurar **`API_LISTEN_ADDRESS=127.0.0.1`**, pois o padrão documentado é `0.0.0.0`. Configurar `API_URL` para a URL local efetiva, porque os túneis dependem dela. [Variáveis de ambiente](https://github.com/imputnet/cobalt/blob/a636575b09de1fc55d9b8cd98cac88f5f2f16b42/docs/api-env-variables.md#general-vars).
- Na API, `localProcessing: preferred/forced` significa que o **cliente** recebe fluxos para juntar ou converter. É independente da decisão de hospedar o servidor da API no computador ou numa VPS. Mesmo com servidor no `localhost`, o Nib precisa implementar as etapas que a resposta `local-processing` delega ao cliente, ou deixar o servidor processar quando apropriado. [Contrato da API](https://github.com/imputnet/cobalt/blob/a636575b09de1fc55d9b8cd98cac88f5f2f16b42/docs/api.md#local-processing-response), [código de decisão](https://github.com/imputnet/cobalt/blob/a636575b09de1fc55d9b8cd98cac88f5f2f16b42/api/src/processing/match-action.js).
- Se a API ficar pública numa VPS, o guia recomenda proteção contra abuso por desafio/API key e uso de reverse proxy. Isso adiciona operação, custo e tratamento de dados/links no servidor. [Hospedagem](https://github.com/imputnet/cobalt/blob/a636575b09de1fc55d9b8cd98cac88f5f2f16b42/docs/run-an-instance.md), [proteção](https://github.com/imputnet/cobalt/blob/a636575b09de1fc55d9b8cd98cac88f5f2f16b42/docs/protect-an-instance.md).

## Proposta de primeiro protótipo técnico

1. Executar a API Cobalt como processo filho em Windows, presa ao loopback; verificar inicialização, encerramento e `GET /`.
2. Fazer uma solicitação real por tipo de resposta que conseguirmos reproduzir (`redirect`, `tunnel`, `picker`, `local-processing`, `error`) e validar fluxo completo até o arquivo no disco.
3. Verificar instalação/empacotamento de Node, `ffmpeg-static` e dependências nativas como `isolated-vm` no instalador desktop; o repositório não fornece esse pacote pronto.
4. Construir uma fila mínima persistente própria e eventos `recebido → analisando → transferindo → processando → concluído/erro` para dirigir os sprites do Nib. Testar interrupção e reinício.
5. Só então decidir se algum requisito real exige VPS. A API local é a primeira hipótese, não uma garantia de empacotamento fácil.

Os serviços suportados mudam e podem falhar individualmente; a matriz da API descreve capacidade de projeto, não garantia de disponibilidade em qualquer dia. O Nib deve mostrar erro específico e permitir novas tentativas quando fizer sentido.
