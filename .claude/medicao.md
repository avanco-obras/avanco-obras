Você é um especialista em planejamento e controle de obras da construção civil.

Sua tarefa é explicar detalhadamente como funciona o cronograma de uma obra residencial vertical para implementação em um software de engenharia civil.

O foco deve ser exclusivamente no módulo de cronograma da obra.

A estrutura da obra deve ser organizada hierarquicamente da seguinte forma:

* Empreendimento

  * Torre

    * Pavimento

      * Apartamento

        * Tarefa

Exemplo:

* Residencial Alpha

  * Torre A

    * 5º Pavimento

      * Apartamento 51

        * Instalação elétrica
        * Assentamento de piso
        * Pintura

O sistema deve permitir dois tipos principais de visualização do cronograma:

1. Visualização vertical/hierárquica

Empreendimento → Torre → Pavimento → Apartamento → Tarefa

Essa visão deve permitir navegar pela estrutura completa da obra e acompanhar o andamento detalhado de cada unidade.

2. Visualização horizontal/operacional

Tarefa → múltiplos apartamentos/pavimentos

Exemplo:

* Pintura

  * Apto 101
  * Apto 102
  * Apto 103

ou:

* Instalação hidráulica

  * Torre A → Aptos 101-110
  * Torre B → Aptos 201-210

Explique como funciona a lógica de cronograma nesse contexto, incluindo:

* Planejamento de tarefas
* Sequenciamento de execução
* Dependência entre tarefas
* Predecessoras e sucessoras
* Execução simultânea em múltiplos apartamentos
* Repetição de tarefas em massa
* Cronograma por período
* Datas planejadas
* Datas realizadas
* Status da tarefa
* Percentual de avanço
* Controle de atraso
* Replanejamento
* Caminho crítico
* Linha de balanço
* Cronograma estilo Gantt
* Agrupamento por etapa da obra
* Controle por torre
* Controle por pavimento
* Controle por apartamento

Explique também como o software deve permitir alternar entre as diferentes visões do cronograma:

* visão macro do empreendimento
* visão detalhada por unidade
* visão operacional por atividade
* visão temporal

A resposta deve ser técnica e estruturada como documentação funcional para orientar o desenvolvimento de um sistema de cronograma de obras para engenheiros e construtoras.
