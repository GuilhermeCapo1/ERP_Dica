/**
 * gerarContrato.js
 * Gera o contrato .docx preenchido com os dados do projeto aprovado.
 * 
 * Uso: node gerarContrato.js <outputPath> <dadosJSON>
 */

const {
    Document, Packer, Paragraph, TextRun, AlignmentType,
    BorderStyle, UnderlineType, TabStopType, TabStopPosition,
    LevelFormat, WidthType, Table, TableRow, TableCell,
    ShadingType, VerticalAlign, PageNumber, HeadingLevel,
} = require('docx');
const fs = require('fs');

// ─── Helpers ──────────────────────────────────────────────────────────────

function p(children, opts = {}) {
    return new Paragraph({ children, ...opts });
}

function t(text, opts = {}) {
    return new TextRun({ text: String(text || ''), ...opts });
}

function bold(text, opts = {}) {
    return t(text, { bold: true, ...opts });
}

function linha() {
    return p([t('')]);
}

function titulo(text) {
    return p([bold(text, { size: 24 })], { alignment: AlignmentType.CENTER, spacing: { before: 200, after: 100 } });
}

function clausula(text) {
    return p([bold(text, { size: 22 })], { spacing: { before: 240, after: 80 } });
}

function corpo(children, opts = {}) {
    return p(children, { spacing: { after: 60 }, alignment: AlignmentType.JUSTIFIED, ...opts });
}

function assinatura(texto) {
    return p(
        [t(texto, { size: 20 })],
        { border: { top: { style: BorderStyle.SINGLE, size: 4, color: '000000', space: 8 } }, spacing: { before: 400, after: 60 } }
    );
}

// ─── Função principal ──────────────────────────────────────────────────────

async function gerarContrato(dados, outputPath) {
    const {
        // Dados do projeto
        nome, feira, datas, local, metragem,
        // Dados do cliente (preenchidos na aprovação)
        nomeEmpresa, nomeFantasia, cnpj, cpf, endereco, cidade, estado, cep,
        responsavel,
        // Condições comerciais
        formaPagamento, tipoDocumento, condicoesPagamento, observacoesAprovacao,
        // Número do contrato (gerado pelo backend)
        numeroContrato,
        // Memorial descritivo
        memorial,
        // Orçamento
        orcamento,
        // Data de geração
        dataGeracao,
    } = dados;

    // ── Formata valores ─────────────────────────────────────────────────
    const valorTotal = orcamento?.valorTotal || 0;
    const valorExtenso = orcamento?.valorExtenso || '';
    const tipoDocumentoLabel = tipoDocumento === 'nota_fiscal'
        ? 'Nota Fiscal'
        : tipoDocumento === 'recibo_locacao'
            ? 'Recibo de Locação'
            : tipoDocumento || '';

    const formaPagamentoLabel = formaPagamento === 'boleto'
        ? 'Boleto Bancário'
        : formaPagamento === 'pix'
            ? 'PIX'
            : formaPagamento || 'A combinar';

    const enderecoCompleto = [endereco, cidade && estado ? `${cidade} - ${estado}` : cidade || estado, cep]
        .filter(Boolean).join(', ');

    const documentoCliente = cnpj ? `CNPJ.: ${cnpj}` : cpf ? `CPF: ${cpf}` : '';

    // ─── Memorial descritivo ────────────────────────────────────────────
    const CAMPOS_MEMORIAL = [
        { key: 'piso', label: '01 - PISO' },
        { key: 'estrutura', label: '02 - ESTRUTURA' },
        { key: 'areaAtendimento', label: '03 - ÁREA DE ATENDIMENTO' },
        { key: 'audioVisual', label: '04 - AUDIOVISUAL' },
        { key: 'comunicacaoVisual', label: '05 - COMUNICAÇÃO VISUAL' },
        { key: 'eletrica', label: '06 - ELÉTRICA' },
    ];

    const camposAtivos = memorial ? JSON.parse(memorial.camposAtivos || '[]') : [];
    const paragrafosMemorial = [];

    for (const campo of CAMPOS_MEMORIAL) {
        if (!camposAtivos.includes(campo.key) || !memorial?.[campo.key]) continue;
        paragrafosMemorial.push(
            corpo([bold(`     ${campo.label}`, { size: 22 })])
        );
        // Quebra por linha
        const linhas = (memorial[campo.key] || '').split('\n');
        for (const linha_ of linhas) {
            if (!linha_.trim()) continue;
            paragrafosMemorial.push(
                corpo([t(`   • ${linha_.trim()}`, { size: 22 })])
            );
        }
        paragrafosMemorial.push(linha());
    }

    // ─── Itens do orçamento ─────────────────────────────────────────────
    const itens = orcamento?.itens ? JSON.parse(orcamento.itens) : [];
    const subtotal = itens.reduce((acc, i) => acc + (i.quantidade || 0) * (i.valorUnitario || 0), 0);
    const totalNF = subtotal / 90 * 100;
    const recibo = subtotal;

    const valorFinal = tipoDocumento === 'nota_fiscal' ? totalNF : recibo;
    const valorFinalStr = valorFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // ─── Monta o documento ──────────────────────────────────────────────
    const doc = new Document({
        styles: {
            default: {
                document: { run: { font: 'Arial', size: 22 } },
            },
        },
        sections: [{
            properties: {
                page: {
                    size: { width: 11906, height: 16838 }, // A4
                    margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
                },
            },
            children: [
                // ── Título
                titulo(`INSTRUMENTO PARTICULAR DE CONTRATO DE`),
                titulo(`PRESTAÇÃO DE SERVIÇOS. CONTRATO NÚMERO: ${numeroContrato || '___/2026'}`),
                linha(),

                // ── Qualificação das partes
                corpo([
                    t('São partes neste instrumento,'),
                ]),
                linha(),

                corpo([
                    bold(`${nomeEmpresa || 'RAZÃO SOCIAL DO CLIENTE'}`),
                    t(nomeFantasia ? ` (${nomeFantasia})` : ''),
                    t(enderecoCompleto ? `, com sede ${enderecoCompleto}` : ''),
                    t(documentoCliente ? `, inscrita no ${documentoCliente}` : ''),
                    t(', neste ato legalmente representada na forma do Contrato Social doravante denominada simplesmente '),
                    bold('CONTRATANTE'),
                    t('.'),
                ]),
                linha(),

                corpo([
                    bold('DICA SOLUÇÕES CENOGRAFIA'),
                    t(', com sede a Rua Pindorama, 180 - Bairro: São Rafael – Guarulhos, Cep.: 07053020, inscrita no CNPJ.: 44.343.918/0001-09, Inscrição Estadual Isenta, neste ato legalmente representada na forma do Contrato Social doravante denominada simplesmente '),
                    bold('CONTRATADA'),
                    t('.'),
                ]),
                linha(),

                // ── Cláusula 1
                clausula('CLÁUSULA PRIMEIRA – OBJETIVO DO CONTRATO'),
                corpo([
                    t('1.1 Execução pela CONTRATADA de serviços de montagem de 01 (um) Estande, de acordo com o projeto que nos foi aprovado pela CONTRATANTE.'),
                ]),
                linha(),

                // ── Cláusula 2
                clausula('CLÁUSULA SEGUNDA – LOCAL DA PRESTAÇÃO DE SERVIÇOS'),
                corpo([
                    t('2.1 - Os serviços serão executados na oficina da CONTRATADA e montado na área do Evento, estipulado abaixo:'),
                ]),
                corpo([bold(`2.2 – Evento: ${feira || nome || '—'}`)]),
                corpo([bold(`2.3 – Data: ${datas || '—'}`)]),
                corpo([bold(`2.4 – Local: ${local || '—'}`)]),
                corpo([bold(`2.5 – Metragem: ${metragem ? `${metragem}m²` : '—'};`)]),
                linha(),

                // ── Cláusula 3 — Memorial
                clausula('CLÁUSULA TERCEIRA – MEMORIAL DESCRITIVO'),
                ...(paragrafosMemorial.length > 0 ? paragrafosMemorial : [
                    corpo([t('Conforme memorial descritivo aprovado pelo CONTRATANTE.')]),
                    linha(),
                ]),

                // ── Cláusula 4
                clausula('CLÁUSULA QUATRO – PRAZO DO CONTRATO'),
                corpo([
                    t('4.1 O presente contrato vigorará pelo período entre o fechamento do contrato e o término do evento.'),
                ]),
                linha(),

                // ── Cláusula 5
                clausula('CLÁUSULA QUINTA – ALTERAÇÕES'),
                corpo([
                    t('5.1 – Qualquer alteração no projeto e cardápio após a aprovação e assinatura deste Contrato, deverá ser encaminhada à CONTRATADA, por escrito, com tempo hábil para a sua realização. Uma vez possível, implicará no acréscimo de preço, em valores proporcionais a alteração. O Projeto foi desenvolvido com exclusividade para o cliente, sendo parte integrante deste Contrato de Prestação de Serviços, não podendo ser reproduzido sem expressa autorização da DICA SOLUÇÕES CENOGRAFIA.'),
                ]),
                linha(),

                // ── Cláusula 6
                clausula('CLÁUSULA SEXTA – PROGRAMAÇÃO VISUAL'),
                corpo([t('6.1 – Caberá à CONTRATANTE, encaminhar em tempo hábil à CONTRATADA, todo o material necessário à programação Visual, sejam logotipos/texto/imagens que serão utilizados nos Estandes a fim de evitar divergências quanto a programação.')]),
                corpo([t('6.2 – Os serviços que não estiverem expressamente incluídos no objeto deste contrato serão também considerados como sendo sua parte integrante, visto que se objetiva nele incluir tudo o que for necessário à perfeita e completa execução dos mesmos.')]),
                corpo([t('6.3 – Os serviços serão prestados em regime de não exclusividade, durante a duração deste contrato estando, portanto, a CONTRATADA livre para contratar com terceiras atividades que contenham ou não o objeto descrito neste Contrato.')]),
                corpo([t('6.4 – Fica garantida à CONTRATADA total autonomia no exercício de suas atividades, cabendo à mesma organizar-se da melhor forma possível para que sejam cumpridas efetivamente as atividades supra descritas e o objeto do presente Contrato de Prestação de Serviços.')]),
                linha(),

                // ── Cláusula 7 — Preço
                clausula('CLÁUSULA SÉTIMA – PREÇO E CONDIÇÕES DE PAGAMENTO'),
                corpo([t('7.1 – PREÇO - STAND')]),
                corpo([
                    t('Pelos serviços acima contratados, a CONTRATANTE pagará a CONTRATADA à importância total de:'),
                ]),
                corpo([
                    bold(`${valorFinalStr} - Com ${tipoDocumentoLabel} e ${formaPagamentoLabel}.`),
                ]),
                linha(),
                corpo([bold('7.2 – CONDIÇÕES DE PAGAMENTO - STAND')]),
                corpo([
                    bold(condicoesPagamento || orcamento?.vencimentos || 'A combinar entre as partes.'),
                ]),
                linha(),
                corpo([bold('DICA SOLUÇÕES CENOGRAFIA')]),
                corpo([bold('CNPJ.: 44.343.918/0001-09')]),
                linha(),
                ...(observacoesAprovacao ? [
                    corpo([bold('OBSERVAÇÕES:')]),
                    corpo([t(observacoesAprovacao)]),
                    linha(),
                ] : []),

                // ── Cláusula 8
                clausula('CLÁUSULA OITAVA – TRANSPORTE'),
                corpo([t('8.1 - A CONTRATADA se responsabilizará pelo transporte do material e equipamento necessários a montagem do Stand relacionados na presente proposta, bem como todo o equipamento relacionado no memorial descritivo e sua posterior retirada no término do evento.')]),
                linha(),

                // ── Cláusula 9
                clausula('CLÁUSULA NONA - MÃO DE OBRA'),
                corpo([t('9.1 – Correrá por conta exclusiva da CONTRATADA, toda a mão de obra técnica e especializada necessária a montagem, manutenção técnica e desmontagem do Stand relacionados nesta proposta.')]),
                corpo([t('9.2 – A manutenção será feita diariamente nos horários permitidos pela promotora do evento, sendo reparados eventuais danos na pintura, lâmpadas queimadas, revisão dos aparelhos de ar-condicionados e reparos nos móveis, que deverão ser comunicados ao escritório da CONTRATADA até as 18h00min horas, para serem atendidas no dia seguinte da manutenção.')]),
                corpo([t('9.3 – A CONTRATADA será integralmente responsável por realizar a desmontagem e retirada do estande, materiais, equipamentos e demais itens de sua responsabilidade dentro dos prazos estabelecidos pela promotora do evento.')]),
                linha(),

                // ── Cláusula 10
                clausula('CLÁUSULA DÉCIMA - NORMAS E TAXAS'),
                corpo([t('10.1 – Caberá à CONTRATADA, observar e dar cumprimento às normas internas impostas pela promotora do evento, no que couber a execução dos serviços relacionados a montagem do Stand, cabendo à CONTRATANTE, providenciar o pagamento das taxas de que incidem sobre o funcionamento do Evento (TAXA DE ENERGIA ELÉTRICA, TAXA DE LIMPEZA DE MONTAGEM e CERTIFICADO DE SEGURO DO ESTANDE) para que possa livremente iniciar os trabalhos de montagem, no local do evento.')]),
                linha(),

                // ── Cláusula 11
                clausula('CLÁUSULA DÉCIMA PRIMEIRA – OBRIGAÇÕES DA CONTRATADA'),
                corpo([t('11.1 – A CONTRATADA deverá arcar com todas as despesas referentes a viagens, alimentação e estadia incorridas pelos empregados e contratados da CONTRATADA, caso isto seja necessário à prestação dos serviços.')]),
                corpo([t('11.2 – Não serão admitidos repasses de custos da CONTRATADA, acréscimos ou quaisquer reajustes.')]),
                corpo([t('11.3 – A CONTRATADA deverá programar e executar os serviços de acordo com as condições estabelecidas neste contrato, com a observância dos prazos estipulados para sua conclusão, obedecendo criteriosamente às instruções e especificações constantes da Proposta Comercial.')]),
                corpo([t('11.4 – No tocante à mão-de-obra empregada para realização dos serviços contratados, a CONTRATADA deverá fornecer toda a mão-de-obra necessária, assumindo e providenciando todos os encargos sociais até a conclusão final dos serviços.')]),
                corpo([t('11.5 – A CONTRATADA deverá também pagar aos respectivos agentes arrecadadores todos os tributos e taxas incidentes sobre os serviços objeto deste contrato, notadamente o Imposto Sobre Serviços (ISS).')]),
                linha(),

                // ── Cláusula 12
                clausula('CLÁUSULA DÉCIMA SEGUNDA – LOCAÇÃO DO MATERIAL'),
                corpo([t('12.1 – A CONTRATADA se compromete a locar todo o material necessário e descrito no memorial para a execução do serviço, cabendo à CONTRATANTE, a conservação e bom uso do material a ela locado, a qual responderá por culpa ou dolo pelos danos causados aos mesmos, podendo ser obrigada a repor aquele material quebrado e/ou extraviado.')]),
                linha(),

                // ── Cláusula 13
                clausula('CLÁUSULA DÉCIMA TERCEIRA – PRAZO DE ENTREGA'),
                corpo([t('13.1 – O stand devidamente instalado será liberado à CONTRATANTE, 24 horas antes do evento, salvo detalhes como: aplicação de logotipos, limpeza, os quais serão finalizados até 08:00 horas antes da inauguração oficial do evento. Caso o não cumprimento dessa Cláusula pela Contratada, a Contratante pode aplicar multa de 20% no valor do Contrato.')]),
                linha(),

                // ── Cláusula 14
                clausula('CLÁUSULA DÉCIMA QUARTA - CANCELAMENTO'),
                corpo([t('14.1 - Comunicada intenção de rescisão por uma das partes, deverá a CONTRATADA restituir os valores pagos até o momento pela CONTRATANTE em até 10 dias. Caso parte desistente seja a CONTRATADA, os valores deverão ser restituídos atualizados pelo IPCA + juros 1% ao mês.')]),
                linha(),

                // ── Cláusula 15 — Confidencialidade
                clausula('CLÁUSULA DÉCIMA QUINTA – CONFIDENCIALIDADE'),
                corpo([t('15.1 – As Partes reconhecem que poderão receber ou ter a posse de certas informações e documentos confidenciais durante o prazo de validade deste contrato. Tais informações não poderão ser divulgadas a terceiros sem expressa autorização por escrito da outra Parte.')]),
                corpo([t('15.2 – A CONTRATADA deverá assegurar que a eventual coleta, tratamento, armazenamento e posterior eliminação de dados de terceiros seguirão o rigor da Lei Geral de Proteção de Dados (Lei 13.709/2018).')]),
                linha(),

                // ── Cláusula 16 — Foro
                clausula('CLÁUSULA DÉCIMA SEXTA – FORO'),
                corpo([t('16.1 – Para dirimir quaisquer dúvidas oriundas do presente contrato as partes elegem o foro central da Capital do Estado de São Paulo.')]),
                linha(),

                // ── Encerramento
                corpo([
                    t('E por estarem assim justas e contratadas firmam o presente instrumento em 02 (duas) vias de igual teor e forma, para um só fim de direito.'),
                ]),
                linha(),
                corpo([t(`São Paulo, ${dataGeracao || new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}.`)]),
                linha(),
                linha(),

                // ── Assinaturas
                assinatura(`${nomeEmpresa || 'CONTRATANTE'}`),
                p([
                    t(documentoCliente || '', { size: 20 }),
                ]),
                ...(responsavel ? [p([t(`Responsável: ${responsavel}`, { size: 20 })])] : []),
                linha(),
                linha(),

                assinatura('DICA SOLUÇÕES CENOGRAFIA'),
                p([t('CNPJ.: 44.343.918/0001-09', { size: 20 })]),
                linha(),
                linha(),

                p([bold('Testemunha:', { size: 20 })]),
                linha(),
                p([t('___________________________', { size: 20 })]),
                p([t('Marcela Di Giovanni de Freitas', { size: 20 })]),
                p([t('CPF: 297.830.438-38', { size: 20 })]),
                linha(),
                p([bold('Testemunha:', { size: 20 })]),
                linha(),
                p([t('___________________________', { size: 20 })]),
                p([t('Julia Marie Medley Browne', { size: 20 })]),
                p([t('CPF: 098.651.067-01', { size: 20 })]),
            ],
        }],
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outputPath, buffer);
    console.log('OK');
}

// ── Execução via CLI ──────────────────────────────────────────────────────
const [, , outputPath, dadosJSON] = process.argv;
if (!outputPath || !dadosJSON) {
    console.error('Uso: node gerarContrato.js <output.docx> <dadosJSON>');
    process.exit(1);
}

const dados = JSON.parse(dadosJSON);
gerarContrato(dados, outputPath)
    .then(() => process.exit(0))
    .catch(err => { console.error(err.message); process.exit(1); });