# CATERING AI — BUSINESS CODE

**Status:** CANÔNICO PARA PLANEJAMENTO COMERCIAL / NÃO É CONTRATO  
**Data-base:** 2026-09-05  
**Produto:** Catering AI  
**Piloto atual:** CDL Services BBQ At Home  
**Owner:** PSCS Informática LTDA  

---

## 1. Objetivo deste documento

Este documento é a fonte canônica do planejamento comercial do Catering AI.

Ele existe para registrar, de forma consultável e versionada:

- a tese comercial do produto;
- a diferença entre piloto, implementação e mensalidade;
- a evolução do escopo original;
- o posicionamento dos módulos Base, Pro e Intelligence;
- o plano de monetização de IA, WhatsApp, voz e automações;
- a estratégia de replicação para novas empresas;
- as hipóteses de preço que ainda precisam de benchmark;
- o impacto comercial de cada novo módulo.

**Regra:** valores neste documento só são tratados como preço definitivo quando marcados explicitamente como **APROVADO**. Caso contrário, são hipóteses de planejamento.

---

## 2. Tese de produto

O Catering AI não deve ser vendido apenas como “sistema de cotação”.

A visão é evoluir para uma **plataforma operacional para empresas de catering**, conectando atendimento, vendas, cotação, financeiro, pagamentos, execução, estoque, fornecedores, automações e inteligência artificial.

O Brasinha não deve ser posicionado como “substituto de funcionário”.

O posicionamento preferencial é:

> **Uma camada de inteligência que aumenta a produtividade, padroniza o atendimento e melhora o trabalho da equipe inteira.**

Exemplos de impacto esperado:

- vendedor responde melhor e mais rápido;
- administrativo reduz retrabalho;
- financeiro acompanha cobrança e pagamento;
- operação recebe dados estruturados do evento;
- liderança ganha rastreabilidade e visão de processo;
- clientes recebem atendimento mais consistente;
- conhecimento da empresa deixa de depender apenas de pessoas específicas.

---

## 3. Contexto comercial do piloto CDL

### 3.1. Referência original

A conversa comercial original girava em torno de aproximadamente:

- **R$ 1.500/mês** como referência inicial de assinatura;
- aproximadamente 10 meses como comparação de valor;
- algo na faixa de **R$ 15 mil a R$ 16 mil**;
- expectativa de preço nominal um pouco maior com desconto para chegar perto dessa faixa.

### 3.2. Escopo original associado a essa referência

A referência de aproximadamente **R$ 16 mil** estava ligada principalmente ao produto de **cotação** e ao fluxo comercial inicial.

Ela não deve ser usada automaticamente como preço do produto completo atual.

### 3.3. Expansões que não faziam parte daquela referência original

Entre os itens adicionados ou planejados posteriormente estão:

- invoice;
- payment status;
- integração PayPal;
- configuração PayPal por empresa;
- cupom/desconto governado pelo pricing;
- integração PSCS One / SSO;
- arquitetura multi-company;
- Brasinha AI;
- memória estruturada;
- Training Lab;
- flashcards / knowledge cards;
- avaliação e aprovação de respostas;
- WhatsApp;
- voz;
- futuras automações de financeiro, estoque, compras, fornecedores e operação.

Portanto, **R$ 16 mil não representa o escopo final atual**.

---

## 4. Hipótese atual para valor do piloto completo

### STATUS: EM ESTUDO — NÃO APROVADO

A hipótese atual discutida é buscar uma entrega do piloto completo na região de:

> **~R$ 24.000**

Esse número deve ser tratado como **alvo de negociação / hipótese**, e não como preço final automático.

Motivos para reavaliar acima do escopo original:

1. o projeto deixou de ser apenas cotação;
2. pagamentos e financeiro foram adicionados;
3. IA/Brasinha não faziam parte do acordo inicial;
4. existe esforço real de arquitetura, segurança, QA e multi-company;
5. o piloto está financiando parte da fundação que depois poderá ser replicada;
6. o produto final terá valor operacional maior para a CDL do que o inicialmente previsto.

### Condição de piloto

A CDL deve ser apresentada, quando apropriado, como **cliente piloto / design partner**, recebendo uma condição comercial diferenciada em relação ao preço padrão futuro.

Isso permite conceder benefício comercial sem destruir o preço de referência para novos clientes.

---

## 5. Implementação é cobrada separadamente

**Decisão:** haverá **Implementation Fee**.

A implementação não deve ser escondida dentro da mensalidade.

Pode incluir, conforme o plano contratado:

- onboarding da empresa;
- criação/configuração de usuários;
- PSCS One / SSO;
- cadastro e revisão de catálogo;
- pacotes e preços;
- regras comerciais;
- imagens/mídia;
- configuração de pagamentos;
- configuração PayPal;
- configuração WhatsApp;
- treinamento inicial do Brasinha;
- importação/migração de dados quando aplicável;
- QA;
- go-live;
- treinamento operacional da equipe.

### Regra comercial

Cada novo cliente deve ter:

> **Implementation Fee + Subscription + módulos/consumo quando aplicável**

A mensalidade não deve absorver trabalho de implantação ilimitado.

---

## 6. Modelo de assinatura — hipótese para benchmark

### STATUS: EM ESTUDO — NÃO APROVADO

A estrutura preferencial é por níveis.

### Catering AI Base

Faixa conceitual inicial:

> **~US$ 300/mês**

Objetivo:

- preço de entrada;
- adoção simples;
- cliente percebe valor rapidamente;
- funcionalidades essenciais da plataforma.

Possíveis componentes:

- clientes;
- catálogo;
- pacotes;
- regras;
- cotação;
- operação comercial básica.

### Catering AI Pro / Operations

Hipótese:

> **~US$ 600+/mês**

Possíveis componentes:

- tudo do Base;
- financeiro;
- invoice;
- pagamentos;
- payment status;
- automações;
- estoque;
- compras;
- fornecedores;
- recursos operacionais avançados.

### Catering AI Intelligence

Hipótese futura:

> **faixa superior ao Pro, a definir por benchmark e valor entregue**

Possíveis componentes:

- Brasinha AI;
- memória e knowledge layer;
- Training Lab;
- WhatsApp;
- voz;
- avaliações/evals;
- analytics;
- automações inteligentes;
- recursos de supervisão e handoff humano.

### Regra importante

**US$ 300 é referência de entrada, não preço esperado do sistema completo.**

A expectativa é que clientes que utilizem a plataforma completa gerem ticket superior.

---

## 7. Custos variáveis de IA e canais

Não prometer IA ilimitada por padrão.

Custos que podem variar por uso:

- provider de IA;
- tokens/modelos;
- transcrição;
- geração de voz;
- WhatsApp Business Platform;
- armazenamento de mídia;
- processamento adicional;
- gateways de pagamento, quando aplicável.

Modelos comerciais possíveis:

1. franquia incluída por plano;
2. excedente cobrado por uso;
3. pacote adicional de consumo;
4. pass-through de custos externos;
5. combinação de mensalidade + consumo.

**Decisão futura:** definir a melhor combinação após medir o consumo real do piloto.

---

## 8. Estratégia de replicação

Objetivo principal do piloto:

> Construir uma fundação configurável e multi-company que possa ser replicada para novas empresas sem refazer o produto do zero.

A lógica de escala é:

**Produto comum**  
+ **configuração por empresa**  
+ **Implementation Fee**  
+ **assinatura recorrente**  
+ **módulos adicionais**  
+ **consumo variável quando necessário**

### Ilustração simples de MRR

Exemplo histórico de referência:

- 10 clientes × R$ 1.500/mês = **R$ 15.000 MRR**.

Essa conta é apenas ilustrativa porque o objetivo atual é validar tickets maiores para planos completos.

Com tickets próximos a US$ 600 ou superiores, o potencial de MRR muda significativamente.

---

## 9. Próximos passos para concluir Cotação V1

Ordem preferencial:

1. finalizar breakdown visual do pacote/guarnições;
2. implementar cupom/desconto V1 de forma canônica no pricing;
3. criar usuário do Caio no PSCS One;
4. mapear permissões corretas para CDL DEV;
5. permitir que Caio configure as próprias credenciais PayPal Sandbox;
6. validar conexão PayPal;
7. validar webhook Sandbox;
8. executar E2E quote → invoice → payment link → PayPal Sandbox → status;
9. executar QA adversarial/regressão;
10. declarar formalmente **PUBLIC QUOTE V1 = DONE**.

### Regra

PayPal deve permanecer **SANDBOX ONLY** até decisão explícita de go-live.

---

## 10. Roadmap Brasinha após fechamento da Cotação V1

### Fase A — Training Lab

Permitir que usuários autorizados treinem e avaliem o Brasinha dentro do próprio Catering AI.

Fluxo conceitual:

**Resposta do Brasinha → 👍 aprovado / 👎 precisa melhorar → comentário/correção → revisão → liberação**

### Fase B — Memory / Knowledge Layer

Criar memória robusta e governada.

Separar:

- conhecimento canônico;
- memória do cliente;
- estado da conversa;
- regras comerciais;
- knowledge cards;
- exemplos aprovados;
- avaliações;
- fontes/versionamento.

### Fase C — Flashcards / Knowledge Cards

Cada card pode conter:

- pergunta/situação;
- resposta esperada;
- idioma;
- tool esperada;
- fonte canônica;
- tags;
- aprovado por;
- data;
- versão;
- status;
- **liberado SIM/NÃO**.

Somente conteúdo aprovado e liberado deve influenciar comportamento de produção.

### Fase D — WhatsApp

Objetivo:

- cliente interage pelo WhatsApp;
- Catering AI permanece como cockpit interno;
- mesma memória;
- mesmas tools;
- mesma empresa;
- handoff humano quando necessário.

### Fase E — Voz

Fluxo desejado:

**áudio WhatsApp → transcrição → Brasinha → resposta → texto e/ou áudio**

A voz deve ser módulo/benefício adicional, não obrigação do plano de entrada.

---

## 11. Política de treinamento do Brasinha

Conversar com o Brasinha não significa que o modelo “aprende sozinho”.

O treinamento do produto deve acontecer por uma combinação de:

- feedback humano;
- prompt versionado;
- tools canônicas;
- structured state;
- knowledge cards;
- regras documentadas;
- casos de teste;
- evals;
- eventualmente fine-tuning, somente se houver justificativa futura.

### Ciclo recomendado

1. usuário testa;
2. avalia resposta;
3. registra correção;
4. correção é revisada;
5. conhecimento é aprovado/liberado;
6. caso vira teste/eval;
7. nova versão do Brasinha é validada contra casos antigos;
8. somente depois é promovida.

---

## 12. Governança comercial de novos módulos

A partir deste documento, cada novo módulo deve receber avaliação em dois eixos:

### A. Impacto de implementação

Perguntar:

- aumenta onboarding?
- exige configuração por cliente?
- exige integração externa?
- exige treinamento?
- exige migração?
- exige QA específico?

Se sim, deve influenciar o **Implementation Fee**.

### B. Impacto recorrente

Perguntar:

- aumenta valor mensal entregue?
- aumenta consumo de infraestrutura?
- aumenta uso de IA?
- reduz trabalho manual relevante?
- cria nova capacidade vendável?

Se sim, deve influenciar:

- plano Base / Pro / Intelligence;
- MRR;
- add-on mensal;
- ou cobrança por consumo.

### Regra operacional para desenvolvimento

Sempre que um novo módulo for proposto, registrar:

- escopo funcional;
- plano sugerido;
- impacto no Implementation Fee;
- impacto sugerido no MRR;
- custos externos esperados;
- dependências;
- status: hipótese / aprovado.

---

## 13. Benchmark de mercado — pesquisa obrigatória antes do preço final

Antes de definir tabela oficial, pesquisar concorrentes e produtos adjacentes nos EUA e, quando útil, Brasil.

Comparar pelo menos:

1. catering management platforms;
2. event/catering CRM;
3. quoting/proposal software;
4. payment/invoice solutions;
5. operational management;
6. inventory/purchasing;
7. WhatsApp automation;
8. AI agents/customer service;
9. voice AI;
10. implementation/onboarding fees.

Para cada concorrente registrar:

- setup/implementation fee;
- mensalidade;
- preço por usuário;
- preço por location;
- limites de uso;
- módulos extras;
- IA incluída ou separada;
- custos de WhatsApp/voz;
- contrato mínimo;
- posicionamento de mercado.

### Resultado esperado do benchmark

Definir:

- Implementation Fee padrão;
- Base MRR;
- Pro MRR;
- Intelligence MRR;
- política de consumo;
- desconto máximo de piloto;
- margem-alvo;
- CAC/payback aceitável.

---

## 14. Métricas de negócio a acompanhar

Quando iniciar a expansão comercial, acompanhar:

- MRR;
- ARR;
- clientes ativos;
- ticket médio;
- Implementation Revenue;
- churn;
- gross margin;
- custo de infraestrutura por cliente;
- custo de IA por cliente;
- custo WhatsApp/voz por cliente;
- tempo médio de implantação;
- suporte por cliente;
- CAC;
- payback;
- conversão de Base → Pro → Intelligence.

---

## 15. Princípios comerciais permanentes

1. **Não vender desenvolvimento infinito dentro da mensalidade.**
2. **Implementation Fee é separado da assinatura.**
3. **Cliente piloto pode ter condição especial, mas o desconto deve ser visível como benefício de piloto.**
4. **Não vender IA ilimitada sem medir consumo.**
5. **Cada módulo novo deve ter impacto comercial avaliado.**
6. **Preço deve refletir valor operacional, não apenas horas de código.**
7. **Arquitetura multi-company é fundamental para replicação.**
8. **Conhecimento do Brasinha deve ser governado e versionado.**
9. **Cotação, pagamentos e IA devem compartilhar fontes canônicas, evitando duplicar regras.**
10. **O piloto deve gerar produto replicável, não uma customização impossível de revender.**

---

## 16. Estado atual das decisões

| Tema | Estado |
|---|---|
| Implementation Fee | **DECIDIDO: SIM** |
| Preço final do piloto CDL | **EM ESTUDO** |
| Referência aproximada de R$ 24 mil para piloto completo | **HIPÓTESE ATUAL** |
| Base próximo de US$ 300/mês | **HIPÓTESE PARA BENCHMARK** |
| Sistema completo acima de US$ 600/mês | **HIPÓTESE PARA BENCHMARK** |
| Plano Intelligence | **PLANEJADO** |
| IA ilimitada | **NÃO RECOMENDADA** |
| PayPal Live | **NÃO AUTORIZADO / SANDBOX PRIMEIRO** |
| Brasinha Training Lab | **PLANEJADO APÓS COTAÇÃO V1** |
| Memory / Flashcards | **PLANEJADO** |
| WhatsApp | **PLANEJADO** |
| Voz | **PLANEJADO** |
| Benchmark formal de mercado | **PENDENTE** |

---

## 17. Protocolo de atualização deste Business Code

Este documento deve ser atualizado quando ocorrer qualquer uma destas situações:

- mudança relevante de escopo;
- definição de preço;
- novo módulo comercial;
- novo plano;
- alteração de estratégia de implementação;
- novo custo externo significativo;
- início de benchmark;
- decisão de go-live;
- aprendizado relevante do piloto CDL.

Ao atualizar, manter:

- data;
- decisão anterior quando relevante;
- nova decisão;
- motivo;
- status APROVADO / HIPÓTESE / PENDENTE.

---

## 18. Resumo executivo

A tese comercial atual é:

> **Catering AI será uma plataforma operacional multi-company para empresas de catering, vendida com Implementation Fee + assinatura recorrente + módulos/consumo quando aplicável.**

O piloto CDL começou com uma referência comercial ligada principalmente à cotação, próxima de R$ 16 mil. O produto expandiu significativamente e a hipótese atual é reavaliar o piloto completo na região de R$ 24 mil, ainda sujeita à definição final de escopo e negociação.

Para novos clientes, a referência de US$ 300/mês deve ser tratada como possível porta de entrada, enquanto versões completas com operações e inteligência devem buscar tickets maiores, potencialmente US$ 600+/mês ou superiores, dependendo do benchmark e do valor efetivamente entregue.

O objetivo estratégico é transformar o piloto em uma fundação replicável, reduzir o custo marginal de implantação e construir MRR crescente com Base, Pro e Intelligence.
