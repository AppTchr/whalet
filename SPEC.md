# spec.md

# Carteiras de Finanças Pessoais

## 1. Visão Geral do Produto

Carteiras de Finanças Pessoais é um sistema de gestão financeira baseado em carteiras, projetado para fornecer visibilidade financeira real em múltiplos contextos, como pessoal, doméstico, empresarial, familiar e por projetos.

O produto permite que um usuário se autentique usando **email + OTP**, crie múltiplas carteiras, compartilhe carteiras específicas com outros usuários por meio de permissões granulares, gerencie transações com isolamento estrito por carteira, controle cartões de crédito e compras parceladas, e registre transferências entre carteiras com rastreabilidade completa.

O sistema é projetado para que cada usuário veja apenas:
- carteiras que ele criou
- carteiras às quais teve acesso concedido

O produto deve suportar tanto:
- visibilidade direta do fluxo de caixa
- visibilidade de obrigações diferidas

Isso significa que o produto não deve mostrar apenas o que já foi pago, mas também o que já está comprometido por meio de:
- compras no cartão de crédito
- faturas em aberto
- planos de parcelamento
- obrigações recorrentes futuras
- transferências entre carteiras

---

## 2. Objetivos do Produto

### Objetivos primários
- Dar ao usuário visibilidade real sobre suas finanças
- Permitir a separação de contextos financeiros por meio de múltiplas carteiras
- Suportar gestão colaborativa de carteiras com controle de permissões
- Fornecer movimentações financeiras rastreáveis entre carteiras
- Controlar cartões de crédito e despesas parceladas como objetos financeiros de primeira classe
- Construir um fluxo de autenticação seguro e simples usando OTP via email

### Objetivos secundários
- Preparar o produto para relatórios futuros, orçamentos, lançamentos recorrentes e previsão anual
- Manter o modelo de domínio robusto o suficiente para escalar do uso pessoal ao familiar e de pequenas empresas
- Prevenir vazamento de dados entre usuários e carteiras
- Reduzir a cegueira financeira causada pelo uso fragmentado de cartões e obrigações futuras ocultas

---

## 3. Visão do Produto

O produto deve se comportar como um **sistema operacional financeiro baseado em carteiras**.

Em vez de um usuário possuir uma lista plana de transações, o usuário possui ou acessa uma ou mais carteiras, como:
- Carteira Pessoal
- Carteira Doméstica
- Carteira Empresarial
- Carteira Familiar
- Carteira de Projeto

Cada carteira é isolada e pode opcionalmente ser compartilhada com outros usuários.

O produto deve tratar o **acesso à carteira** como o principal limite de autorização.

Além disso, cada carteira pode conter um ou mais recursos financeiros, como:
- contas em dinheiro
- contas bancárias
- cartões de crédito
- categorias
- transações
- obrigações parceladas
- relatórios

---

## 4. Conceitos Fundamentais

## 4.1 Usuário
Uma pessoa que se autentica usando email e OTP.

Um usuário pode:
- criar carteiras
- acessar carteiras que possui
- acessar carteiras compartilhadas com ele
- realizar transações se tiver permissão

## 4.2 Carteira
Uma carteira é um espaço financeiro isolado.

Uma carteira contém:
- transações
- saldos
- relatórios
- membros com permissões
- cartões de crédito
- planos de parcelamento
- obrigações financeiras futuras

Exemplos:
- Minha Carteira Pessoal
- Minha Carteira da Casa
- Minha Carteira da Empresa

## 4.3 Associação à Carteira
Uma associação à carteira vincula um usuário a uma carteira.

Uma associação define:
- qual carteira o usuário pode acessar
- qual papel o usuário tem nessa carteira
- se o acesso está ativo ou revogado

## 4.4 Transação
Uma transação é um lançamento financeiro registrado dentro de uma carteira.

Exemplos:
- salário recebido
- aluguel pago
- conta de internet
- compra de supermercado
- pagamento de fatura
- compra no cartão de crédito
- despesa parcelada
- transferência entre carteiras

## 4.5 Transferência
Uma transferência é uma movimentação vinculada entre duas carteiras.

Exemplo:
- Carteira empresarial paga salário
- Carteira pessoal recebe salário

Isso deve gerar:
- uma despesa na carteira de origem
- uma receita na carteira de destino
- um relacionamento rastreável entre ambos os registros

## 4.6 Cartão de Crédito
Um cartão de crédito é um instrumento de pagamento vinculado a uma carteira.

Um cartão de crédito contém:
- identidade do cartão
- informações do ciclo de faturamento
- contexto de crédito disponível e comprometido
- faturas
- compras vinculadas
- compras parceladas

Um cartão pertence a exatamente uma carteira.

## 4.7 Fatura
Uma fatura representa o ciclo de faturamento de um cartão de crédito para um período.

Uma fatura agrega compras no cartão de acordo com:
- data de fechamento da fatura
- data de vencimento
- regras de faturamento do cartão

As faturas permitem que o produto mostre:
- valor aberto atual
- valor futuro projetado
- status pago e não pago
- compras alocadas em um ciclo de faturamento

## 4.8 Compra Parcelada
Uma compra parcelada é uma obrigação financeira dividida em múltiplos períodos futuros.

Exemplo:
- Compra de notebook em 10 parcelas
- Curso pago em 6 parcelas
- Eletrodoméstico pago em 12 parcelas

O sistema deve permitir que o usuário saiba:
- valor total original
- quantidade de parcelas
- número da parcela atual
- parcelas restantes
- impacto futuro por mês
- cartão de crédito de origem quando aplicável

As parcelas são essenciais porque representam compromissos futuros que devem ser visíveis antes de o dinheiro sair da conta.

---

## 5. Autenticação

## 5.1 Método de autenticação
O sistema deve autenticar usuários por meio de:
- email
- token OTP enviado por email

## 5.2 Fluxo de login
1. Usuário informa o email
2. Sistema gera o OTP
3. Sistema envia o OTP por email
4. Usuário informa o OTP
5. Sistema valida o OTP
6. Sistema cria a sessão autenticada

## 5.3 Regras de autenticação
- O OTP deve expirar após um curto período
- O OTP deve ser de uso único
- As tentativas de OTP devem ser limitadas
- O reenvio do OTP deve ter limite de taxa
- As sessões devem ser armazenadas e validadas com segurança
- Os tokens OTP nunca devem ser expostos em logs
- Os tokens OTP nunca devem ser retornados em URLs ou query strings

## 5.4 Fluxo de primeiro acesso
Se o email não existir:
- o sistema cria uma nova conta de usuário
- o usuário é redirecionado para o onboarding

Se o email já existir:
- o sistema autentica o usuário existente

---

## 6. Modelo de Autorização

A autorização deve ser baseada em carteira.

Um usuário nunca deve acessar dados apenas por estar autenticado.
Um usuário pode acessar dados somente se tiver uma associação ativa na carteira correspondente.

## 6.1 Papéis na carteira

### owner (proprietário)
Pode:
- visualizar a carteira
- criar transações
- editar transações
- gerenciar configurações da carteira
- convidar usuários
- alterar papéis de membros
- revogar acesso
- arquivar carteira
- gerenciar cartões de crédito
- gerenciar faturas
- gerenciar registros de parcelamento

### editor
Pode:
- visualizar a carteira
- criar transações
- editar transações
- criar transferências
- operar a carteira no dia a dia
- criar e editar compras no cartão
- registrar compras parceladas

Não pode:
- gerenciar membros
- alterar a propriedade da carteira
- revogar outros usuários
- alterar configurações críticas da carteira, salvo se explicitamente permitido futuramente

### viewer (visualizador)
Pode:
- visualizar dados da carteira
- visualizar transações
- visualizar saldos
- visualizar relatórios
- visualizar cartões
- visualizar faturas
- visualizar parcelamentos

Não pode:
- criar transações
- editar transações
- criar transferências
- gerenciar usuários
- alterar configurações

## 6.2 Status da associação
Uma associação à carteira pode ter os seguintes status:
- ativo
- convidado
- revogado

Apenas associações ativas concedem acesso.

---

## 7. Onboarding

O onboarding deve ajudar o usuário a começar a usar o sistema rapidamente.

## 7.1 Etapas iniciais do onboarding
1. Criar a primeira carteira
2. Escolher o tipo de carteira
3. Opcionalmente definir o saldo inicial
4. Opcionalmente registrar o primeiro cartão de crédito
5. Selecionar a carteira como padrão
6. Opcionalmente convidar outro usuário

## 7.2 Tipos sugeridos de carteira
- pessoal
- doméstica
- empresarial
- familiar
- projeto
- personalizada

---

## 8. Gestão de Carteiras

## 8.1 Criar carteira
Um usuário pode criar uma ou mais carteiras.

Campos da carteira:
- nome
- tipo
- moeda
- saldo inicial
- descrição opcional

Quando uma carteira é criada:
- o criador torna-se seu proprietário
- uma associação ativa de proprietário é criada automaticamente

## 8.2 Listar carteiras
Um usuário deve ver apenas carteiras em que possui associação ativa.

## 8.3 Atualizar carteira
Apenas proprietários podem atualizar os metadados da carteira por padrão.

## 8.4 Arquivar carteira
Os proprietários podem arquivar uma carteira em vez de excluí-la.

Carteiras arquivadas:
- permanecem nos registros históricos
- deixam de ser primárias para as operações diárias
- podem ser ocultadas das visualizações ativas normais

---

## 9. Compartilhamento de Carteiras

## 9.1 Fluxo de compartilhamento
Um proprietário pode compartilhar uma carteira com outra pessoa por email.

Fluxo:
1. Proprietário seleciona uma carteira
2. Proprietário seleciona a ação de compartilhar
3. Proprietário informa o email do usuário convidado
4. Proprietário escolhe o papel
5. Sistema cria a associação ou convite
6. Usuário convidado obtém acesso conforme o modelo configurado

## 9.2 Comportamento do compartilhamento
O sistema pode suportar um dos seguintes modos:
- acesso direto se o email alvo já pertencer a um usuário conhecido
- convite pendente de aceitação caso contrário

Para o MVP, a vinculação direta por email é aceitável, desde que o produto garanta que apenas o email autenticado correspondente possa acessar a associação.

## 9.3 Revogar acesso
Um proprietário pode revogar o acesso à carteira a qualquer momento.

Quando o acesso é revogado:
- o usuário perde imediatamente o acesso à carteira
- os registros históricos criados por esse usuário permanecem
- os metadados de autoria são preservados para fins de auditoria

---

## 10. Transações

## 10.1 Tipos de transação
O produto deve suportar no mínimo:
- receita (income)
- despesa (expense)
- transferência recebida (transfer_in)
- transferência enviada (transfer_out)
- compra no cartão de crédito (credit_card_purchase)
- pagamento de fatura (invoice_payment)

## 10.2 Campos da transação
Cada transação deve suportar:
- carteira
- tipo
- descrição
- valor
- categoria
- data da transação
- data de vencimento
- status
- observações
- criado pelo usuário
- atualizado pelo usuário
- método de pagamento
- conta ou cartão de origem quando aplicável

## 10.3 Status da transação
Status sugeridos:
- pendente
- pago
- cancelado

Mais status podem ser adicionados posteriormente se necessário.

## 10.4 Permissões de escrita
Apenas usuários com papel:
- owner (proprietário)
- editor

podem criar ou editar transações.

Usuários com papel:
- viewer (visualizador)

podem apenas ler transações.

---

## 11. Transferências Entre Carteiras

## 11.1 Objetivo
O sistema deve suportar transferências entre carteiras com rastreabilidade completa.

Isso é necessário para cenários como:
- carteira empresarial pagando salário para a carteira pessoal
- carteira pessoal enviando fundos para a carteira doméstica
- carteira de projeto financiando outra carteira

## 11.2 Comportamento da transferência
Uma transferência entre carteiras deve gerar:
- uma transação de saída na carteira de origem
- uma transação de entrada na carteira de destino
- um registro de transferência vinculando ambos os lados

## 11.3 Exemplo
Carteira empresarial paga salário para carteira pessoal.

Resultado:
- Carteira empresarial recebe uma transação de despesa
- Carteira pessoal recebe uma transação de receita
- Ambas são vinculadas pelo mesmo registro de transferência

## 11.4 Permissões de transferência
Para criar uma transferência entre duas carteiras, o usuário deve ter acesso de escrita em ambas as carteiras para o MVP.

Isso significa que o usuário deve ser:
- owner ou editor na carteira de origem
- owner ou editor na carteira de destino

## 11.5 Regra de relatórios
Transferências entre carteiras não devem ser tratadas como receita ou despesa externa nos relatórios consolidados de todas as carteiras do mesmo contexto do usuário, caso contrário os relatórios ficam distorcidos.

No nível da carteira:
- transfer_out se comporta como uma movimentação de saída
- transfer_in se comporta como uma movimentação de entrada

No nível consolidado global:
- transferências internas devem ser neutralizadas

Essa distinção é fundamental para uma inteligência financeira precisa.

---

## 12. Cartões de Crédito

## 12.1 Objetivo
O sistema deve suportar cartões de crédito como entidades financeiras de primeira classe, pois grande parte do controle financeiro real depende da compreensão de obrigações diferidas e faturas futuras.

## 12.2 Propriedade do cartão
Um cartão de crédito pertence a apenas uma carteira.

Exemplos:
- Carteira pessoal possui cartões pessoais
- Carteira empresarial possui cartões empresariais

## 12.3 Campos do cartão de crédito
Cada cartão deve suportar:
- carteira
- nome do cartão
- emissor ou banco
- limite de crédito
- dia de fechamento
- dia de vencimento
- bandeira do cartão (opcional)
- últimos quatro dígitos (opcional)
- status ativo ou arquivado

## 12.4 Regras do cartão de crédito
O sistema deve permitir:
- registrar um ou mais cartões por carteira
- editar metadados do cartão
- arquivar cartões sem excluir o histórico
- vincular compras a um cartão específico
- projetar o impacto na fatura usando as datas do ciclo de faturamento

## 12.5 Visibilidade do cartão
Usuários com acesso à carteira podem ver apenas cartões das carteiras às quais têm permissão de acesso.

---

## 13. Compras no Cartão de Crédito

## 13.1 Objetivo
O sistema deve permitir o registro de compras realizadas com cartão de crédito.

Essas compras não devem se comportar exatamente como despesas imediatas em dinheiro, pois afetam:
- totais da fatura
- datas de vencimento futuras
- uso do limite do cartão
- meses futuros quando compras parceladas estão envolvidas

## 13.2 Campos da compra
Uma compra no cartão deve suportar:
- carteira
- cartão de crédito
- descrição
- valor
- categoria
- data da compra
- referência do ciclo de faturamento
- informações de parcelamento quando aplicável
- observações
- criado pelo usuário

## 13.3 Comportamento da compra
Quando uma compra é criada:
- deve ser atribuída a um cartão
- deve afetar a fatura correta com base na data da compra e nas regras do ciclo de faturamento
- deve atualizar os totais projetados da fatura
- deve ser consultável por carteira, cartão e fatura

---

## 14. Compras Parceladas

## 14.1 Objetivo
O sistema deve suportar compras parceladas porque representam gastos futuros comprometidos e são essenciais para um planejamento financeiro realista.

## 14.2 Campos da compra parcelada
Cada compra parcelada deve suportar:
- carteira
- cartão de crédito (opcional)
- descrição
- valor total
- valor da parcela
- total de parcelas
- sequência da parcela atual
- data da compra
- primeiro período de faturamento ou primeiro período de vencimento
- categoria
- observações
- criado pelo usuário

## 14.3 Comportamento de geração das parcelas
Quando uma compra é marcada como parcelada, o sistema deve gerar ou representar todas as obrigações de parcelamento.

O sistema deve ser capaz de mostrar:
- parcela 1 de N
- parcelas restantes
- impacto futuro mensal
- faturas afetadas por parcelas futuras quando vinculadas a um cartão de crédito

## 14.4 Parcelamentos sem cartão de crédito
O sistema também pode suportar despesas parceladas fora do contexto de cartão de crédito, como:
- plano de pagamento direto em loja
- parcelamento de mensalidades
- parcelamento de contratos de serviço

Nesses casos, a lógica de parcelamento ainda se aplica mesmo quando não há cartão de crédito.

## 14.5 Regras de edição
O sistema deve definir regras seguras para edição de compras parceladas.

No mínimo:
- a edição não deve corromper silenciosamente obrigações já geradas
- parcelas pagas não devem ser livremente alteradas sem tratamento explícito
- parcelas futuras podem ser recalculadas quando permitido pelas regras de negócio

---

## 15. Faturas

## 15.1 Objetivo
As faturas permitem ao usuário entender o que está devido em cada ciclo do cartão e quanto já está comprometido.

## 15.2 Campos da fatura
Cada fatura deve suportar:
- cartão de crédito
- período de faturamento
- data de fechamento
- data de vencimento
- valor total
- valor pago
- valor em aberto
- status

## 15.3 Status da fatura
Status sugeridos:
- aberta
- fechada
- paga
- vencida

## 15.4 Composição da fatura
Uma fatura pode conter:
- compras avulsas no cartão
- cobranças de parcelamento do ciclo
- ajustes
- correções manuais, se permitido futuramente

## 15.5 Pagamento da fatura
Quando uma fatura é paga, o sistema deve registrar uma transação do tipo `invoice_payment` na carteira.

Isso é importante porque:
- a compra no cartão representa a criação do compromisso
- o pagamento da fatura representa a saída real de dinheiro

Essa distinção proporciona relatórios financeiros mais precisos.

---

## 16. Auditabilidade

O sistema deve preservar a rastreabilidade de ações importantes.

## 16.1 Metadados de auditoria
Registros importantes devem incluir:
- created_by_user_id
- updated_by_user_id
- invited_by_user_id
- revoked_by_user_id

## 16.2 Princípios de auditoria
- a revogação de acesso não deve excluir o histórico
- a exclusão de registros deve ser evitada em favor do cancelamento ou arquivamento
- o sistema deve preservar quem criou uma transação mesmo que esse usuário perca o acesso posteriormente
- o histórico de parcelamentos e compras no cartão deve permanecer auditável mesmo após o arquivamento do cartão

---

## 17. Regras de Visibilidade de Dados

O produto deve isolar estritamente os dados por associação à carteira.

## 17.1 Visibilidade da carteira
Um usuário pode visualizar uma carteira apenas se tiver uma associação ativa nela.

## 17.2 Visibilidade das transações
Um usuário pode visualizar apenas transações pertencentes a carteiras às quais tem acesso.

## 17.3 Visibilidade do cartão
Um usuário pode visualizar apenas cartões de crédito, faturas e compras parceladas pertencentes a carteiras às quais tem acesso.

## 17.4 Visibilidade dos membros
Apenas proprietários podem gerenciar membros.  
Editores e visualizadores podem ver listas de membros apenas se as regras do produto permitirem explicitamente no futuro.

## 17.5 Segurança entre carteiras
O sistema nunca deve vazar:
- nomes de carteiras
- saldos
- transações
- cartões
- faturas
- parcelamentos
- relatórios
- listas de membros

de carteiras às quais o usuário não pertence.

---

## 18. Requisitos Funcionais

## 18.1 Requisitos de autenticação
- O sistema deve permitir login usando email e OTP
- O sistema deve enviar OTP por email
- O sistema deve validar a expiração e o uso único do OTP
- O sistema deve criar uma sessão autenticada segura

## 18.2 Requisitos de usuário
- O sistema deve criar um usuário automaticamente na primeira verificação bem-sucedida de OTP se o email for novo
- O sistema deve permitir que usuários autenticados mantenham o acesso por meio de sessões válidas

## 18.3 Requisitos de carteira
- O sistema deve permitir que um usuário crie múltiplas carteiras
- O sistema deve permitir que um usuário visualize apenas suas carteiras acessíveis
- O sistema deve permitir que proprietários atualizem as informações da carteira
- O sistema deve permitir que proprietários arquivem carteiras

## 18.4 Requisitos de associação
- O sistema deve permitir que proprietários compartilhem carteiras por email
- O sistema deve permitir que proprietários definam papéis de membros
- O sistema deve permitir que proprietários revoguem acesso
- O sistema deve impor operações baseadas em papel

## 18.5 Requisitos de transação
- O sistema deve permitir que proprietários e editores criem transações de receita
- O sistema deve permitir que proprietários e editores criem transações de despesa
- O sistema deve permitir que visualizadores apenas leiam transações
- O sistema deve preservar a autoria das transações

## 18.6 Requisitos de transferência
- O sistema deve permitir transferências vinculadas entre carteiras
- O sistema deve criar ambos os lados de uma transferência atomicamente
- O sistema deve preservar o relacionamento entre ambos os registros gerados
- O sistema deve impedir a persistência parcial de uma transferência se um lado falhar

## 18.7 Requisitos de cartão de crédito
- O sistema deve permitir que proprietários e editores criem e gerenciem cartões de crédito dentro de uma carteira
- O sistema deve permitir que compras no cartão sejam vinculadas a um cartão específico
- O sistema deve alocar compras no ciclo de fatura correto
- O sistema deve projetar valores futuros de faturas

## 18.8 Requisitos de parcelamento
- O sistema deve permitir compras parceladas com ou sem cartão de crédito
- O sistema deve armazenar o total de parcelas e as parcelas restantes
- O sistema deve mostrar o impacto futuro mensal
- O sistema deve preservar o relacionamento entre uma compra original e seu cronograma de parcelamento

## 18.9 Requisitos de fatura
- O sistema deve criar ou manter visualizações de faturas por ciclo do cartão
- O sistema deve mostrar totais e status da fatura
- O sistema deve suportar o registro do pagamento de faturas
- O sistema deve distinguir o compromisso de compra do pagamento em dinheiro da fatura

---

## 19. Requisitos Não Funcionais

## 19.1 Segurança
- Os tokens OTP devem ser armazenados com segurança, preferencialmente com hash
- As sessões devem ser assinadas ou armazenadas com segurança
- As rotas devem impor autenticação e autorização por carteira
- Eventos sensíveis devem ser registrados com segurança sem vazar valores de OTP
- Limites de taxa devem ser aplicados a operações relacionadas ao OTP

## 19.2 Consistência
- As transferências devem ser atômicas
- As associações de carteira devem ser validadas em cada ação com escopo de carteira
- Alterações de papel e revogações devem ter efeito imediato
- Compras no cartão devem resolver para a fatura correta de forma consistente
- A geração de parcelas deve permanecer coerente ao longo de períodos futuros

## 19.3 Escalabilidade
A arquitetura deve suportar:
- usuários com muitas carteiras
- carteiras com muitos membros
- histórico crescente de transações
- múltiplos cartões por carteira
- grandes cronogramas de parcelamento
- módulos futuros como transações recorrentes, orçamentos e relatórios

## 19.4 Auditabilidade
O sistema deve preservar relacionamentos históricos e metadados de autoria para operações importantes.

---

## 20. Histórias de Usuário Iniciais

### Autenticação
- Como usuário, quero fazer login usando meu email e um OTP para que eu possa acessar o sistema sem precisar de senha.
- Como usuário, quero receber o OTP por email para que eu possa entrar com segurança.

### Carteiras
- Como usuário, quero criar múltiplas carteiras para que eu possa separar as finanças pessoais, domésticas e empresariais.
- Como usuário, quero ver apenas as carteiras que possuo ou às quais tenho acesso para que meus dados financeiros permaneçam isolados.

### Compartilhamento
- Como proprietário de uma carteira, quero compartilhar uma carteira específica com outra pessoa para que ela possa colaborar comigo.
- Como proprietário de uma carteira, quero definir se outra pessoa pode apenas ler ou também escrever para que eu possa controlar como ela usa a carteira.
- Como proprietário de uma carteira, quero revogar o acesso a qualquer momento para que eu possa parar imediatamente de compartilhar a carteira.

### Transações
- Como editor, quero registrar receitas e despesas dentro de uma carteira autorizada para que os registros financeiros fiquem atualizados.
- Como visualizador, quero ver os registros da carteira sem poder alterá-los para que eu possa monitorar as finanças com segurança.

### Transferências
- Como usuário, quero transferir valor de uma carteira para outra com rastreabilidade para que eu possa representar movimentações reais de dinheiro, como pagamentos de salário da minha empresa para minha carteira pessoal.

### Cartões de crédito
- Como usuário, quero registrar meus cartões de crédito dentro de uma carteira para que eu possa rastrear obrigações por contexto financeiro.
- Como usuário, quero registrar compras em um cartão para que eu possa saber qual fatura e qual mês elas afetam.

### Parcelamentos
- Como usuário, quero registrar compras parceladas para que eu possa saber quantas parcelas restam e quanto os meses futuros já estão comprometidos.
- Como usuário, quero que as despesas parceladas apareçam no planejamento futuro para que eu pare de subestimar meu gasto real.

### Faturas
- Como usuário, quero ver as faturas abertas e futuras de cada cartão para que eu possa entender quanto já comprometi antes de o dinheiro sair da minha conta.
- Como usuário, quero registrar pagamentos de faturas para que o sistema reflita corretamente a saída real de dinheiro.

---

## 21. Modelo de Domínio Sugerido

### users
- id
- email
- status
- created_at
- updated_at

### user_otps
- id
- user_id nullable
- email
- token_hash
- expires_at
- used_at
- attempts
- created_at

### auth_sessions
- id
- user_id
- token_hash
- expires_at
- last_seen_at
- ip
- user_agent
- created_at

### wallets
- id
- owner_user_id
- name
- type
- currency
- initial_balance
- is_archived
- created_at
- updated_at

### wallet_members
- id
- wallet_id
- user_id
- role
- status
- invited_by_user_id
- invited_at
- revoked_at
- created_at
- updated_at

### credit_cards
- id
- wallet_id
- name
- issuer
- brand nullable
- last_four nullable
- credit_limit nullable
- closing_day
- due_day
- is_archived
- created_at
- updated_at

### credit_card_invoices
- id
- credit_card_id
- billing_year
- billing_month
- closing_date
- due_date
- total_amount
- paid_amount
- outstanding_amount
- status
- created_at
- updated_at

### installment_plans
- id
- wallet_id
- credit_card_id nullable
- description
- category_id nullable
- total_amount
- installment_amount
- total_installments
- start_date
- created_by_user_id
- created_at
- updated_at

### installment_entries
- id
- installment_plan_id
- installment_number
- billing_year nullable
- billing_month nullable
- due_date nullable
- amount
- status
- credit_card_invoice_id nullable
- created_at
- updated_at

### transactions
- id
- wallet_id
- type
- status
- description
- amount
- category_id nullable
- credit_card_id nullable
- credit_card_invoice_id nullable
- installment_plan_id nullable
- installment_entry_id nullable
- transaction_date
- due_date nullable
- notes nullable
- transfer_id nullable
- payment_method nullable
- created_by_user_id
- updated_by_user_id nullable
- created_at
- updated_at
- deleted_at nullable

### transfers
- id
- origin_wallet_id
- destination_wallet_id
- origin_transaction_id
- destination_transaction_id
- amount
- description
- transfer_date
- created_by_user_id
- created_at
- updated_at

---

## 22. Módulos de API Sugeridos

- auth
- users
- wallets
- wallet-members
- transactions
- transfers
- credit-cards
- credit-card-invoices
- installment-plans
- reports
- audit-logs
- notifications

---

## 23. Escopo do MVP

O MVP deve incluir:

### autenticação
- solicitar OTP
- verificar OTP
- criar sessão
- logout

### carteiras
- criar carteira
- listar minhas carteiras
- atualizar carteira
- arquivar carteira

### compartilhamento
- adicionar membro por email
- listar membros
- revogar acesso de membro
- definir papel do membro

### transações
- criar receita
- criar despesa
- listar transações por carteira
- editar transação

### transferências
- criar transferência entre carteiras
- listar transferências
- visualizar detalhes da transferência

### cartões de crédito
- criar cartão de crédito
- listar cartões da carteira
- atualizar cartão
- arquivar cartão

### faturas
- listar faturas por cartão
- visualizar detalhes da fatura
- registrar pagamento de fatura

### compras parceladas
- criar compra parcelada
- listar planos de parcelamento
- visualizar parcelas restantes
- projetar cobranças mensais futuras

### dashboard básico
- resumo de saldo da carteira
- transações recentes
- contagem de membros
- resumo de faturas do cartão
- parcelamentos futuros
- totais de entradas e saídas por carteira

---

## 24. Escopo Futuro

Itens intencionalmente deixados para fases posteriores:
- transações recorrentes
- orçamentos
- previsão anual
- notificações
- anexos
- conciliação
- sincronização bancária
- relatórios avançados
- tags e filtros personalizados
- fluxos de aprovação
- múltiplas moedas
- API pública
- aplicativo mobile

---

## 25. Princípios do Produto

- A carteira é o verdadeiro limite de propriedade e acesso
- A autenticação deve ser simples para o usuário e segura para o sistema
- O isolamento de dados deve ser rigoroso
- A colaboração deve ser explícita e revogável
- As transferências devem preservar a rastreabilidade financeira
- Os relatórios devem distinguir movimentações internas de receitas e despesas reais
- Os compromissos do cartão de crédito devem ser visíveis antes do pagamento da fatura
- Os parcelamentos devem ser visíveis como obrigações futuras
- O histórico de auditoria deve ser preservado

---

## 26. Resumo dos Critérios de Aceite

### Login por OTP
- usuário solicita OTP com email
- usuário recebe OTP via email
- OTP válido cria sessão
- OTP expirado é rejeitado
- OTP já utilizado é rejeitado

### Criação de carteira
- usuário autenticado cria carteira
- carteira é armazenada
- associação de proprietário é criada automaticamente

### Listagem de carteiras
- usuário vê apenas carteiras onde a associação está ativa

### Compartilhamento de carteira
- proprietário compartilha carteira com outro email
- usuário convidado obtém acesso à carteira conforme o papel
- proprietário pode revogar o acesso posteriormente

### Criação de transação
- owner/editor pode criar transações
- viewer não pode criar transações

### Criação de transferência
- criar uma transferência gera dois registros vinculados
- ambos os registros são armazenados atomicamente
- ambos os registros permanecem rastreáveis pelo vínculo de transferência

### Controle de cartão de crédito
- usuário pode criar um cartão dentro de uma carteira
- compras podem ser vinculadas a um cartão
- compras são alocadas nos ciclos de fatura
- totais da fatura são visíveis

### Controle de parcelamentos
- usuário pode registrar compras parceladas
- sistema mostra parcelas restantes
- sistema projeta impacto futuro

### Pagamento de fatura
- usuário pode registrar o pagamento de fatura do cartão
- sistema distingue pagamento de fatura da criação de compra

### Isolamento de dados
- usuário não pode acessar carteiras ou transações sem associação

---

## 27. Decisões de Produto em Aberto

Estas decisões devem ser finalizadas antes da implementação:

### Convites
- associação direta por email
- ou fluxo de aceitação de convite

### Visibilidade do gerenciamento de membros
- quem pode ver a lista de membros além do proprietário

### Estratégia de exclusão de transações
- soft delete
- ou abordagem de cancelamento apenas

### Modelo de propriedade da carteira
- proprietário único apenas
- ou múltiplos proprietários futuramente

### Categorias padrão
- apenas padrões globais
- ou personalização específica por carteira desde o início

### Estratégia de faturas do cartão
- faturas totalmente materializadas
- ou visualizações de faturas computadas com persistência opcional

### Estratégia de representação de parcelamentos
- gerar antecipadamente todas as linhas de parcelamento
- ou computar linhas futuras dinamicamente e persistir apenas conforme necessário

---

## 28. Resumo Final

Este produto é um sistema financeiro seguro baseado em carteiras com:
- autenticação via email + OTP
- múltiplas carteiras por usuário
- compartilhamento de carteiras com permissões controladas
- isolamento rigoroso de dados
- gestão de transações por carteira
- rastreamento de cartões de crédito por carteira
- controle de compras parceladas
- visibilidade de faturas e rastreamento de pagamentos
- transferências vinculadas com rastreabilidade completa

Sua arquitetura é intencionalmente projetada para começar como uma solução de finanças pessoais, enquanto já suporta cenários colaborativos e empresariais sem alterar o modelo central.
