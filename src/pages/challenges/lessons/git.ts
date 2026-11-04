import type { Lesson } from './types'

export const GIT_LESSONS: Record<string, Lesson> = {
  "git-first_steps-1": {
    concept: "O Git é um programa que guarda versões de um projeto. Você conversa com ele no terminal. A forma git --version consulta a instalação, e a opção -h de um subcomando exibe um resumo de uso.",
    workedExample: "Abra o Git Bash na sua pasta de treino e digite git log -h. A ajuda lista formas de consultar o histórico, como --oneline. Você pode ler essas opções antes de ter commits.",
    pitfall: "git log é um subcomando. git --version consulta o programa como um todo. Colocar a opção no lugar errado pode pedir ajuda de outro comando ou dar erro.",
    checkpoint: {
      question: "Qual comando informa a versão do Git instalada?",
      options: [
        "git status --version",
        "git --version",
        "git version -h"
      ],
      correct: 1,
      explanation: "Use --version logo depois de git. A resposta mostra a versão do executável encontrado no terminal."
    }
  },
  "git-first_steps-2": {
    concept: "git init cria a estrutura interna do Git na pasta atual. A opção -b escolhe o nome da branch inicial. O primeiro commit ainda precisa ser criado para a branch ter um histórico.",
    workedExample: "Em uma pasta nova de treino chamada caderno-teste, rode git init -b caderno. Em seguida, git status mostra que você está na branch caderno e que ainda não há commits.",
    pitfall: "Antes de inicializar, confira a pasta em que está. O Git registra a pasta atual, inclusive quando você entrou nela por engano.",
    checkpoint: {
      question: "Logo depois de git init -b caderno numa pasta vazia, quantos commits existem?",
      options: [
        "Um, criado automaticamente com o nome caderno",
        "Um, criado automaticamente com o nome inicial",
        "Nenhum, até você registrar o primeiro commit"
      ],
      correct: 2,
      explanation: "Inicializar cria os metadados do repositório. Criar um commit é uma operação separada."
    }
  },
  "git-first_steps-3": {
    concept: "Os commits incluem nome e e-mail de autoria. git config --local guarda a configuração neste repositório. Essa camada pode usar uma identidade diferente da configuração global do computador.",
    workedExample: "No repositório de treino, rode git config --local user.name \"Pessoa de Exemplo\" e depois git config --local --get user.name. A leitura devolve Pessoa de Exemplo.",
    pitfall: "O escopo --global afeta outros repositórios da conta do sistema. Para configurar apenas este exercício, use --local.",
    checkpoint: {
      question: "Qual comando lê apenas o e-mail registrado no repositório atual?",
      options: [
        "git config --local --get user.email",
        "git config --global --get user.email",
        "git config --local user.email aluno@example.invalid"
      ],
      correct: 0,
      explanation: "A opção --local escolhe o arquivo de configuração do repositório e --get consulta o valor sem alterá-lo."
    }
  },
  "git-first_steps-4": {
    concept: "Um arquivo novo existe na pasta de trabalho antes de ser rastreado pelo Git. git status --short resume o estado. O marcador ?? indica um caminho que ainda não foi adicionado ao Git.",
    workedExample: "Crie agenda.txt num repositório de treino e veja git status --short. A linha ?? agenda.txt informa que o arquivo existe, mas ainda não entrou na área de preparação.",
    pitfall: "Salvar um arquivo no editor não o inclui no próximo commit. Consulte o status para saber o que o Git já conhece.",
    checkpoint: {
      question: "Qual situação normalmente produz ?? agenda.txt?",
      options: [
        "agenda.txt foi incluído no último commit",
        "agenda.txt está no disco e ainda não é rastreado",
        "agenda.txt foi adicionado ao próximo commit com git add"
      ],
      correct: 1,
      explanation: "?? indica um arquivo não rastreado. Depois de preparar a adição, o Git mostra um estado diferente."
    }
  },
  "git-first_steps-5": {
    concept: "Pense no commit como um registro do que estava na área de preparação. git add copia a versão atual do caminho escolhido para essa área. git commit guarda essa seleção com uma mensagem.",
    workedExample: "Em seu repositório de treino, crie receita.txt. Use git add receita.txt e depois git commit -m \"Registra receita\". git log -1 --oneline mostra o registro que acabou de ser criado.",
    pitfall: "Se você editar receita.txt depois de git add, a nova edição precisa de outro git add para entrar no mesmo commit.",
    checkpoint: {
      question: "Que versão entra no commit se você preparar receita.txt e depois editá-lo novamente, sem preparar a segunda edição?",
      options: [
        "A versão mais recente do disco",
        "Nenhuma versão porque o arquivo foi alterado depois",
        "A versão que estava no disco quando você fez git add"
      ],
      correct: 2,
      explanation: "git commit usa o conteúdo preparado. A edição posterior permanece no diretório de trabalho até ser adicionada."
    }
  },
  "git-basic-1": {
    concept: "O histórico é uma sequência de registros. git log mostra os commits e HEAD aponta para o commit em uso. HEAD~1 referencia seu primeiro pai. git show permite examinar um commit específico.",
    workedExample: "Num treino com três commits, git log -3 --oneline mostra uma linha para cada registro. git show --stat HEAD~1 lista os caminhos alterados pelo penúltimo commit, junto com o resumo.",
    pitfall: "git show --stat informa quais arquivos e quantas linhas mudaram. Para ler o conteúdo do patch, rode git show sem --stat.",
    checkpoint: {
      question: "Em um histórico linear com pelo menos dois commits, a que HEAD~1 se refere?",
      options: [
        "Ao commit imediatamente anterior ao atual",
        "Ao commit mais antigo do repositório",
        "À primeira linha ainda sem commit"
      ],
      correct: 0,
      explanation: "O sufixo ~1 segue um passo pela cadeia de primeiros pais a partir de HEAD."
    }
  },
  "git-basic-2": {
    concept: "Você já separou os arquivos preparados dos demais com git add. git diff compara a pasta de trabalho com a preparação. git diff --staged compara a preparação com o último commit.",
    workedExample: "No treino, acrescente \"linha A\" a guia.txt e prepare o arquivo. Em seguida, acrescente \"linha B\" sem preparar de novo. git diff mostra B. git diff --staged mostra A.",
    pitfall: "Um git diff simples vazio pode significar que tudo já está preparado. Consulte também --staged antes de concluir que nada mudou.",
    checkpoint: {
      question: "Qual comando mostra o que entrará no próximo commit em relação ao último?",
      options: [
        "git diff",
        "git diff --staged",
        "git log --oneline"
      ],
      correct: 1,
      explanation: "A opção --staged compara o conteúdo preparado ao commit atual. O diff comum mostra alterações que ainda estão fora dessa preparação."
    }
  },
  "git-basic-3": {
    concept: "Para fazer um commit pequeno, prepare cada caminho de acordo com a intenção da mudança. Antes de registrar, git diff --staged --name-only lista os caminhos da seleção atual.",
    workedExample: "No treino, crie glossario.txt e ideias-soltas.txt. Prepare apenas glossario.txt com git add glossario.txt. A lista de caminhos preparados deve mostrar somente glossario.txt.",
    pitfall: "Adicionar um caminho específico não remove caminhos já preparados. Confira toda a seleção antes de executar o commit.",
    checkpoint: {
      question: "Se docs.txt já está preparado e você roda git add guia.txt, o que está preparado depois?",
      options: [
        "Só guia.txt",
        "Só docs.txt, pois o Git permite um arquivo por vez",
        "docs.txt e guia.txt"
      ],
      correct: 2,
      explanation: "git add acrescenta ou atualiza o caminho selecionado. O conteúdo já preparado de outros arquivos permanece na seleção."
    }
  },
  "git-basic-4": {
    concept: "Uma branch é um nome que aponta para um commit. git switch -c cria uma branch no ponto atual e passa a trabalhar nela. O próximo commit avança essa branch.",
    workedExample: "Comece em main no commit A do repositório de treino. Use git switch -c pratica-leitura e registre B. pratica-leitura aponta para B. main continua apontando para A.",
    pitfall: "Criar um nome com git branch recurso não troca a branch atual. Confira a branch marcada antes de registrar o próximo commit.",
    checkpoint: {
      question: "Em qual branch o próximo commit entra após git switch -c treino-sql?",
      options: [
        "treino-sql",
        "main e treino-sql ao mesmo tempo",
        "main até fazer o primeiro merge"
      ],
      correct: 0,
      explanation: "switch -c cria a branch e a seleciona. O commit move a referência da branch em uso."
    }
  },
  "git-basic-5": {
    concept: "Fast-forward é possível quando a branch de destino é ancestral da branch que será integrada. Nesse caso, o Git pode avançar a referência do destino. --ff-only exige essa forma de integração.",
    workedExample: "No repositório de treino, main aponta para A e aula aponta para A → B → C. Em main, git merge --ff-only aula move main para C. As duas branches passam a apontar para C.",
    pitfall: "A branch selecionada é o destino do merge. Confira git branch --show-current antes de integrar a outra branch.",
    checkpoint: {
      question: "Se main e aula têm commits diferentes depois do mesmo ponto de origem, o que faz git merge --ff-only aula em main?",
      options: [
        "Cria um commit de merge",
        "Interrompe porque as branches divergiram",
        "Descarta os commits exclusivos de main"
      ],
      correct: 1,
      explanation: "A opção --ff-only só permite avançar a referência numa linha de histórico existente. Histórias divergentes precisam de outra forma de integração."
    }
  },
  "git-intermediate-1": {
    concept: "Um conflito acontece quando a combinação automática não consegue decidir entre mudanças concorrentes. Leia os trechos marcados, edite para obter o resultado desejado e prepare a versão resolvida com git add.",
    workedExample: "Em treino, uma branch troca a primeira linha de plano.txt para \"Ler capítulos\" e a outra para \"Revisar notas\". Ao resolver, você pode manter as duas linhas. Remova <<<<<<<, ======= e >>>>>>> antes de preparar.",
    pitfall: "Apagar apenas os marcadores pode deixar conteúdo duplicado ou incoerente. Releia o arquivo final e confira git status.",
    checkpoint: {
      question: "Depois de editar um arquivo em conflito para a versão correta, como sinalizar que ele foi resolvido?",
      options: [
        "Executar git log no arquivo",
        "Repetir git merge sem preparar",
        "Executar git add no arquivo resolvido"
      ],
      correct: 2,
      explanation: "git add registra a versão resolvida na área de preparação. Depois que todos os conflitos forem resolvidos, você pode concluir a integração."
    }
  },
  "git-intermediate-2": {
    concept: "O stash guarda temporariamente trabalho ainda sem commit. Dê um nome à entrada para encontrá-la depois. git stash apply reaplica a alteração e mantém a entrada guardada.",
    workedExample: "No repositório de treino, modifique agenda.txt já rastreado. Guarde com git stash push -m \"Ideia para amanhã\". Após git stash apply, a alteração volta à pasta de trabalho e git stash list ainda mostra a entrada.",
    pitfall: "O stash padrão não inclui arquivos não rastreados. Confira git status e use a opção apropriada se precisar guardá-los também.",
    checkpoint: {
      question: "Qual ação reaplica um stash e deixa a entrada disponível para consulta posterior?",
      options: [
        "git stash pop",
        "git stash apply",
        "git stash list"
      ],
      correct: 1,
      explanation: "apply restaura as alterações sem retirar a entrada do stash. list apenas enumera as entradas."
    }
  },
  "git-intermediate-3": {
    concept: "git revert registra uma nova mudança que inverte a alteração de um commit escolhido. Essa abordagem mantém o histórico legível quando outras pessoas podem depender dos commits anteriores.",
    workedExample: "No treino, um commit B adiciona uma regra incorreta a guia.txt. Reverter B cria C com a retirada da regra. O histórico continua A → B → C, registrando o erro e a correção.",
    pitfall: "Reverter um commit antigo pode gerar conflito se o conteúdo foi alterado depois. Revise a inversão antes de concluir.",
    checkpoint: {
      question: "Após reverter B com sucesso, o que acontece com B no histórico?",
      options: [
        "Continua no histórico, seguido por um novo commit que desfaz sua alteração",
        "É apagado e substituído por C na mesma posição",
        "É movido para o stash"
      ],
      correct: 0,
      explanation: "Revert acrescenta uma inversão como outro commit. As referências anteriores continuam registradas no histórico."
    }
  },
  "git-intermediate-4": {
    concept: "Um remoto é um nome que aponta para outro repositório. Um repositório bare guarda o histórico sem uma pasta de arquivos de trabalho. Um caminho local pode servir de remoto para praticar push e acompanhamento.",
    workedExample: "Em treino, crie um destino com git init --bare -b main ../espelho-treino.git. Associe o caminho com git remote add espelho ../espelho-treino.git. git remote -v mostra o caminho no disco.",
    pitfall: "Um nome como origin não garante qual é o destino. Confira a URL ou o caminho do remoto antes de enviar commits.",
    checkpoint: {
      question: "O que git remote add espelho ../espelho-treino.git faz?",
      options: [
        "Envia imediatamente main para a pasta espelho-treino.git",
        "Cria um atalho para o caminho no disco, sem enviar commits",
        "Cria uma conta remota chamada espelho"
      ],
      correct: 1,
      explanation: "remote add registra um nome e seu destino. Um push posterior é que envia referências e objetos ao repositório apontado."
    }
  },
  "git-intermediate-5": {
    concept: "Use .gitignore para evitar que arquivos gerados e ainda não rastreados entrem no versionamento. Cada linha descreve um padrão. git check-ignore -v mostra qual regra cobre um caminho.",
    workedExample: "No treino, inclua *.tmp em .gitignore e crie cache.tmp. git check-ignore -v cache.tmp mostra a linha que cobre o arquivo. O arquivo continua disponível na pasta.",
    pitfall: "Adicionar um padrão de ignore não muda o estado de um arquivo que já está no histórico e continua rastreado.",
    checkpoint: {
      question: "O que acontece se um arquivo de log já for rastreado quando você acrescenta *.log a .gitignore?",
      options: [
        "O Git apaga o arquivo do disco",
        "O Git remove automaticamente o arquivo do próximo commit",
        "O arquivo continua rastreado"
      ],
      correct: 2,
      explanation: "As regras de ignore orientam a seleção de caminhos não rastreados. Elas não retiram arquivos que já estão na área rastreada."
    }
  },
  "git-advanced-1": {
    concept: "Cherry-pick reaplica a alteração de um commit escolhido à branch atual. Ele serve quando você precisa de uma correção específica, enquanto as outras mudanças da branch de origem devem ficar onde estão.",
    workedExample: "No treino, uma branch tem o commit B que corrige um título e o commit C que adiciona ilustrações. Em outra branch, git cherry-pick B aplica a correção do título. As ilustrações de C ficam na branch de origem.",
    pitfall: "Um commit pode depender de mudanças anteriores. Confira seu patch e suas dependências antes de reaplicá-lo isoladamente.",
    checkpoint: {
      question: "Qual operação aplica a mudança de um único commit escolhido à branch atual?",
      options: [
        "git cherry-pick <commit>",
        "git merge <branch>",
        "git switch <branch>"
      ],
      correct: 0,
      explanation: "Cherry-pick seleciona um commit pelo identificador. A operação reaplica o patch correspondente ao contexto da branch atual."
    }
  },
  "git-advanced-2": {
    concept: "Rebase reaplica commits de uma branch sobre outra base. O exercício usa uma branch privada, pois os commits reaplicados podem ganhar novos hashes. Confira quais commits serão reaplicados antes de começar.",
    workedExample: "No treino, main avançou de A para M. Sua branch privada tem B a partir de A. Em sua branch, git rebase main refaz a alteração de B sobre M e forma A → M → B′.",
    pitfall: "Rodar rebase na branch errada muda a sequência que você está tentando preservar. Confirme a branch atual e se os commits são privados.",
    checkpoint: {
      question: "Qual branch deve estar selecionada ao rodar git rebase main para atualizar recurso-local?",
      options: [
        "main",
        "recurso-local",
        "Uma branch recém-criada e vazia"
      ],
      correct: 1,
      explanation: "O rebase reaplica os commits da branch atual sobre a base indicada. Nesse caso, os commits de recurso-local devem ser movidos para cima de main."
    }
  },
  "git-advanced-3": {
    concept: "git bisect usa busca binária entre um commit conhecido como bom e outro conhecido como ruim. Em cada etapa, um teste classifica o commit atual. Um comando automatizado deve indicar sucesso com código 0.",
    workedExample: "No treino, o marcador inicio tem um arquivo modo.txt com \"ativo\" e HEAD mostra \"quebrado\". Depois de iniciar o bisect, git bisect run grep -qx ativo modo.txt usa o conteúdo para classificar cada versão. Finalize com git bisect reset.",
    pitfall: "Um teste que muda de resultado a cada execução pode indicar o commit errado. Escolha uma verificação repetível e rápida.",
    checkpoint: {
      question: "Como git bisect run interpreta código de saída 0 do teste?",
      options: [
        "O commit testado é ruim",
        "O commit testado é bom",
        "O commit testado deve ser pulado"
      ],
      correct: 1,
      explanation: "Por convenção, código 0 indica sucesso. Bisect usa isso como classificação boa para reduzir o intervalo da busca."
    }
  },
  "git-advanced-4": {
    concept: "O reflog registra mudanças locais de referências, incluindo posições recentes de HEAD. Se você perdeu uma referência para um commit, encontre o hash no reflog e crie uma branch apontando para ele.",
    workedExample: "Suponha que git reflog mostre a entrada a1b2c3d com a mensagem \"Notas avulsas\". No repositório de treino, git branch notas-recuperadas a1b2c3d cria um nome para o commit. Use o hash exibido no seu próprio reflog.",
    pitfall: "O reflog pertence ao repositório local e suas entradas expiram. Crie uma referência para o commit que precisa preservar enquanto ele ainda está disponível.",
    checkpoint: {
      question: "Qual operação cria um nome para um commit recuperado sem mudar a posição de main?",
      options: [
        "git switch main",
        "git reflog --oneline",
        "git branch recuperada <hash>"
      ],
      correct: 2,
      explanation: "git branch com nome e hash cria outra referência apontando para o commit indicado. main permanece no commit que já tinha."
    }
  },
  "git-advanced-5": {
    concept: "Um worktree é uma pasta de trabalho adicional que compartilha o histórico do repositório. Cada pasta pode ter uma branch selecionada e uma área de preparação própria. Isso permite revisar outra branch sem interromper o trabalho atual.",
    workedExample: "No repositório de treino, git worktree add -b checar-guia ../revisao-guia cria uma pasta irmã com a branch checar-guia. git worktree list mostra os dois caminhos. Rode git -C ../revisao-guia status para consultar a segunda pasta.",
    pitfall: "Por padrão, o Git impede usar a mesma branch em dois worktrees simultâneos. Dê à nova pasta uma branch própria.",
    checkpoint: {
      question: "O que dois worktrees do mesmo repositório compartilham?",
      options: [
        "O histórico e os objetos Git, com arquivos de trabalho separados",
        "Os arquivos de trabalho, com históricos independentes",
        "Todos os arquivos e a mesma área de preparação"
      ],
      correct: 0,
      explanation: "As pastas enxergam o mesmo repositório e seu histórico. Cada worktree tem o próprio diretório de trabalho e índice."
    }
  }
}
