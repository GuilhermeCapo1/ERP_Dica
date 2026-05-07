/**
 * gerarContrato.js
 * Gera o contrato .docx preenchido com os dados do projeto aprovado.
 * Coloque este arquivo na raiz do projeto, junto com server.js.
 *
 * Uso: node gerarContrato.js <outputPath> <dadosJSON>
 */

// createRequire permite usar require() em projetos com "type": "module"
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import fs from 'fs';

const require = createRequire(import.meta.url);

const {
    Document, Packer, Paragraph, TextRun, AlignmentType,
} = require('docx');

// ─── Helpers ──────────────────────────────────────────────────────────────

function p(children, opts = {}) {
    return new Paragraph({ children, ...opts });
}

function t(text, opts = {}) {
    return new TextRun({ text: String(text ?? ''), ...opts });
}

function bold(text, opts = {}) {
    return t(text, { bold: true, ...opts });
}

function linha() {
    return p([t('')], { spacing: { after: 60 } });
}

function titulo(text) {
    return p([bold(text, { size: 24 })], {
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 100 },
    });
}

function clausula(text) {
    return p([bold(text, { size: 22 })], { spacing: { before: 280, after: 80 } });
}

function corpo(children, opts = {}) {
    return p(children, {
        spacing: { after: 80 },
        alignment: AlignmentType.JUSTIFIED,
        ...opts,
    });
}

function linhaAssinatura() {
    return p(
        [t('_______________________________________________________________________________________')],
        { spacing: { before: 560, after: 60 } }
    );
}

function linhaTestemunha() {
    return p(
        [t('___________________________')],
        { spacing: { before: 400, after: 40 } }
    );
}

// ─── Função principal ──────────────────────────────────────────────────────

async function gerarContrato(dados, outputPath) {
    const {
        nome, feira, datas, local, metragem,
        nomeEmpresa, nomeFantasia, cnpj, cpf,
        endereco, cidade, estado, cep, responsavel,
        formaPagamento, tipoDocumento, condicoesPagamento, observacoesAprovacao,
        numeroContrato,
        agencia,
        memorial,
        orcamento,
        dataGeracao,
        testemunha1Nome, testemunha1Cpf,
        testemunha2Nome, testemunha2Cpf,
    } = dados;

    const tipoDocumentoLabel = {
        nota_fiscal:    'Nota Fiscal',
        recibo_locacao: 'Recibo de Locação',
    }[tipoDocumento] || tipoDocumento || '';

    const formaPagamentoLabel = {
        boleto: 'Boleto Bancário',
        pix:    'PIX',
    }[formaPagamento] || formaPagamento || 'A combinar';

    const enderecoCompleto = [
        endereco,
        cidade && estado ? `${cidade} - ${estado}` : cidade || estado,
        cep ? `Cep: ${cep}` : null,
    ].filter(Boolean).join(', ');

    const documentoCliente = cnpj ? `CNPJ.: ${cnpj}` : cpf ? `CPF: ${cpf}` : '';

    // Endereço da agência
    const enderecoAgencia = agencia ? [
        agencia.endereco,
        agencia.cidade && agencia.estado ? `${agencia.cidade} - ${agencia.estado}` : agencia.cidade || agencia.estado,
        agencia.cep ? `Cep: ${agencia.cep}` : null,
    ].filter(Boolean).join(', ') : '';

    const documentoAgencia = agencia?.cnpj
        ? `CNPJ.: ${agencia.cnpj}`
        : agencia?.cpf
            ? `CPF: ${agencia.cpf}`
            : '';

    // Valor final
    const itens    = orcamento?.itens ? JSON.parse(orcamento.itens) : [];
    const subtotal = itens.reduce((acc, i) => acc + (Number(i.quantidade) || 0) * (Number(i.valorUnitario) || 0), 0);
    const totalNF  = (subtotal / 90) * 100;
    const valorFinal    = tipoDocumento === 'nota_fiscal' ? totalNF : subtotal;
    const valorFinalStr = valorFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // Memorial descritivo
    const CAMPOS_MEMORIAL = [
        { key: 'piso',              label: '01 - PISO' },
        { key: 'estrutura',         label: '02 - ESTRUTURA' },
        { key: 'areaAtendimento',   label: '03 - ÁREA DE ATENDIMENTO' },
        { key: 'audioVisual',       label: '04 - AUDIOVISUAL' },
        { key: 'comunicacaoVisual', label: '05 - COMUNICAÇÃO VISUAL' },
        { key: 'eletrica',          label: '06 - ELÉTRICA' },
    ];

    const camposAtivos       = memorial ? JSON.parse(memorial.camposAtivos || '[]') : [];
    const paragrafosMemorial = [];

    for (const campo of CAMPOS_MEMORIAL) {
        if (!camposAtivos.includes(campo.key) || !memorial?.[campo.key]) continue;
        paragrafosMemorial.push(corpo([bold(`     ${campo.label}`, { size: 22 })]));
        for (const l of (memorial[campo.key] || '').split('\n')) {
            if (l.trim()) paragrafosMemorial.push(corpo([t(`   • ${l.trim()}`, { size: 22 })]));
        }
        paragrafosMemorial.push(linha());
    }

    if (paragrafosMemorial.length === 0) {
        paragrafosMemorial.push(corpo([t('Conforme memorial descritivo aprovado pelo CONTRATANTE.')]));
        paragrafosMemorial.push(linha());
    }

    // Bloco de qualificação da agência (aparece se houver)
    const blocoAgencia = agencia ? [
        corpo([
            bold(`${agencia.nomeEmpresa}`),
            ...(enderecoAgencia ? [t(`, com sede na ${enderecoAgencia}`)] : []),
            ...(documentoAgencia ? [t(`, inscrita no ${documentoAgencia}`)] : []),
            t(', neste ato legalmente representada na forma do Contrato Social doravante denominada simplesmente '),
            bold('INTERMEDIADORA'),
            t('.'),
        ]),
        linha(),
    ] : [];

    // Testemunhas — preenche com o que tiver, deixa linha se não tiver nome
    function blocoTestemunha(nome, cpf) {
        return [
            p([bold('Testemunha:', { size: 22 })], { spacing: { before: 200, after: 200 } }),
            linhaTestemunha(),
            corpo([t(nome || '')]),
            corpo([t(cpf ? `CPF: ${cpf}` : 'CPF:')]),
        ];
    }

    const doc = new Document({
        styles: {
            default: { document: { run: { font: 'Arial', size: 22 } } },
        },
        sections: [{
            properties: {
                page: {
                    size: { width: 11906, height: 16838 },
                    margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
                },
            },
            children: [

                // ── Título ────────────────────────────────────────────────
                titulo('INSTRUMENTO PARTICULAR DE CONTRATO DE'),
                titulo(`PRESTAÇÃO DE SERVIÇOS. CONTRATO NÚMERO: ${numeroContrato || '___/____'}`),
                linha(),

                // ── Partes ────────────────────────────────────────────────
                corpo([t('São partes neste instrumento,')]),
                linha(),

                // CONTRATANTE
                corpo([
                    bold(`${nomeEmpresa || 'RAZÃO SOCIAL DO CLIENTE'}`),
                    ...(nomeFantasia ? [t(` (${nomeFantasia})`)] : []),
                    ...(enderecoCompleto ? [t(`, com sede na ${enderecoCompleto}`)] : []),
                    ...(documentoCliente ? [t(`, inscrita no ${documentoCliente}`)] : []),
                    t(', neste ato legalmente representada na forma do Contrato Social doravante denominada simplesmente '),
                    bold('CONTRATANTE'), t('.'),
                ]),
                linha(),

                // INTERMEDIADORA (só aparece se houver agência)
                ...blocoAgencia,

                // CONTRATADA
                corpo([
                    bold('DICA SOLUÇÕES CENOGRAFIA'),
                    t(', com sede a Rua Pindorama, 180 - Bairro: São Rafael – Guarulhos, Cep.: 07053020, inscrita no CNPJ.: 44.343.918/0001-09, Inscrição Estadual Isenta, neste ato legalmente representada na forma do Contrato Social doravante denominada simplesmente '),
                    bold('CONTRATADA'), t('.'),
                ]),
                linha(),

                // ── Cláusula 1 ────────────────────────────────────────────
                clausula('CLÁUSULA PRIMEIRA – OBJETIVO DO CONTRATO'),
                corpo([t('1.1 Execução pela CONTRATADA de serviços de montagem de 01 (um) Estande, de acordo com o projeto que nos foi aprovado pela CONTRATANTE.')]),
                linha(),

                // ── Cláusula 2 ────────────────────────────────────────────
                clausula('CLÁUSULA SEGUNDA – LOCAL DA PRESTAÇÃO DE SERVIÇOS'),
                corpo([t('2.1 - Os serviços serão executados na oficina da CONTRATADA e montado na área do Evento, estipulado abaixo:')]),
                corpo([bold(`2.2 – Evento: ${feira || nome || '—'}`)]),
                corpo([bold(`2.3 – Data: ${datas || '—'}`)]),
                corpo([bold(`2.4 – Local: ${local || '—'}`)]),
                corpo([bold(`2.5 – Metragem: ${metragem ? `${metragem}m²` : '—'};`)]),
                linha(),

                // ── Cláusula 3 ────────────────────────────────────────────
                clausula('CLÁUSULA TERCEIRA – MEMORIAL DESCRITIVO'),
                ...paragrafosMemorial,

                clausula('CLÁUSULA QUATRO – PRAZO DO CONTRATO'),
                corpo([t('4.1 O presente contrato vigorará pelo período entre o fechamento do contrato e o término do evento.')]),
                linha(),

                clausula('CLÁUSULA QUINTA – ALTERAÇÕES'),
                corpo([t('5.1 – Qualquer alteração no projeto e cardápio após a aprovação e assinatura deste Contrato, deverá ser encaminhada à CONTRATADA, por escrito, com tempo hábil para a sua realização. Uma vez possível, implicará no acréscimo de preço, em valores proporcionais a alteração. O Projeto foi desenvolvido com exclusividade para o cliente, sendo parte integrante deste Contrato de Prestação de Serviços, não podendo ser reproduzido sem expressa autorização da DICA SOLUÇÕES CENOGRAFIA.')]),
                linha(),

                clausula('CLÁUSULA SEXTA – PROGRAMAÇÃO VISUAL'),
                corpo([t('6.1 – Caberá à CONTRATANTE, encaminhar em tempo hábil à CONTRATADA, todo o material necessário à programação Visual, sejam logotipos/texto/imagens que serão utilizados nos Estandes a fim de evitar divergências quanto a programação.')]),
                corpo([t('6.2 – Os serviços que não estiverem expressamente incluídos no objeto deste contrato serão também considerados como sendo sua parte integrante, visto que se objetiva nele incluir tudo o que for necessário à perfeita e completa execução dos mesmos.')]),
                corpo([t('6.3 – Os serviços serão prestados em regime de não exclusividade, durante a duração deste contrato, estando portanto a CONTRATADA livre para contratar com terceiras atividades que contenham ou não o objeto descrito neste Contrato.')]),
                corpo([t('6.4 – Fica garantida à CONTRATADA total autonomia no exercício de suas atividades, cabendo à mesma organizar-se da melhor forma possível para que sejam cumpridas efetivamente as atividades supra descritas.')]),
                linha(),

                clausula('CLÁUSULA SÉTIMA – PREÇO E CONDIÇÕES DE PAGAMENTO'),
                corpo([t('7.1 – PREÇO - STAND')]),
                corpo([t('Pelos serviços acima contratados, a CONTRATANTE pagará a CONTRATADA à importância total de:')]),
                corpo([bold(`${valorFinalStr}`), t(` - Com ${tipoDocumentoLabel}${formaPagamentoLabel ? ` e ${formaPagamentoLabel}` : ''}.`)]),
                linha(),
                corpo([bold('7.2 – CONDIÇÕES DE PAGAMENTO - STAND')]),
                corpo([bold(condicoesPagamento || orcamento?.vencimentos || 'A combinar entre as partes.')]),
                linha(),
                corpo([bold('DICA SOLUÇÕES CENOGRAFIA')]),
                corpo([bold('CNPJ.: 44.343.918/0001-09')]),
                ...(observacoesAprovacao ? [linha(), corpo([bold('OBSERVAÇÕES:')]), corpo([t(observacoesAprovacao)])] : []),
                linha(),

                clausula('CLÁUSULA OITAVA – TRANSPORTE'),
                corpo([t('8.1 - A CONTRATADA se responsabilizará pelo transporte do material e equipamento necessários a montagem do Stand relacionados na presente proposta, bem como todo o equipamento relacionado no memorial descritivo e sua posterior retirada no término do evento.')]),
                linha(),

                clausula('CLÁUSULA NONA - MÃO DE OBRA'),
                corpo([t('9.1 – Correrá por conta exclusiva da CONTRATADA, toda a mão de obra técnica e especializada necessária a montagem, manutenção técnica e desmontagem do Stand relacionados nesta proposta.')]),
                corpo([t('9.2 – A manutenção será feita diariamente nos horários permitidos pela promotora do evento, sendo reparados eventuais danos na pintura, lâmpadas queimadas, revisão dos aparelhos de ar-condicionados e reparos nos móveis, que deverão ser comunicados ao escritório da CONTRATADA até as 18h00min horas, para serem atendidas no dia seguinte da manutenção.')]),
                corpo([t('9.3 – A CONTRATADA será integralmente responsável por realizar a desmontagem e retirada do estande, materiais, equipamentos e demais itens de sua responsabilidade dentro dos prazos estabelecidos pela promotora do evento. A CONTRATADA responderá, de forma exclusiva, por quaisquer multas, penalidades, taxas ou encargos decorrentes do descumprimento desses prazos, sem qualquer ônus à CONTRATANTE.')]),
                linha(),

                clausula('CLÁUSULA DÉCIMA - NORMAS E TAXAS'),
                corpo([t('10.1 – Caberá à CONTRATADA, observar e dar cumprimento às normas internas impostas pela promotora do evento, no que couber a execução dos serviços relacionados a montagem do Stand, cabendo à CONTRATANTE, providenciar o pagamento das taxas de que incidem sobre o funcionamento do Evento (TAXA DE ENERGIA ELÉTRICA, TAXA DE LIMPEZA DE MONTAGEM e CERTIFICADO DE SEGURO DO ESTANDE) para que possa livremente iniciar os trabalhos de montagem, no local do evento.')]),
                linha(),

                clausula('CLÁUSULA DÉCIMA PRIMEIRA – OBRIGAÇÕES DA CONTRATADA'),
                corpo([t('11.1 – A CONTRATADA deverá arcar com todas as despesas referentes a viagens, alimentação e estadia incorridas pelos empregados e contratados da CONTRATADA, caso isto seja necessário à prestação dos serviços.')]),
                corpo([t('11.2 – Não serão admitidos repasses de custos da CONTRATADA, acréscimos ou quaisquer reajustes, incluindo mão-de-obra, indenizações ou tributos de qualquer natureza sobre a atividade da CONTRATADA ou sobre os serviços.')]),
                corpo([t('11.3 – A CONTRATADA deverá programar e executar os serviços de acordo com as condições estabelecidas neste contrato, com a observância dos prazos estipulados para sua conclusão, obedecendo criteriosamente às instruções e especificações constantes da Proposta Comercial e às instruções da CONTRATANTE.')]),
                corpo([t('11.4 – No tocante à mão-de-obra empregada para realização dos serviços contratados, a CONTRATADA deverá fornecer toda a mão-de-obra necessária, assumindo e providenciando, nas épocas próprias, recolhimento de todos os encargos sociais até a conclusão final dos serviços.')]),
                corpo([t('11.5 – A CONTRATADA deverá também pagar aos respectivos agentes arrecadadores todos os tributos e taxas incidentes sobre os serviços objeto deste contrato, notadamente o Imposto Sobre Serviços (ISS).')]),
                linha(),

                clausula('CLÁUSULA DÉCIMA SEGUNDA – LOCAÇÃO DO MATERIAL'),
                corpo([t('12.1 – A CONTRATADA se compromete a locar todo o material necessário e descrito no memorial para a execução do serviço, cabendo à CONTRATANTE, a conservação e bom uso do material a ela locado, a qual responderá por culpa ou dolo pelos danos causados aos mesmos, podendo ser obrigada a repor aquele material quebrado e/ou extraviado.')]),
                linha(),

                clausula('CLÁUSULA DÉCIMA TERCEIRA – PRAZO DE ENTREGA'),
                corpo([t('13.1 – O stand devidamente instalado será liberado à CONTRATANTE, 24 horas antes do evento, salvo detalhes como: aplicação de logotipos, limpeza, os quais serão finalizados até 08:00 horas antes da inauguração oficial do evento. Caso o não cumprimento dessa Cláusula pela Contratada, a Contratante pode aplicar multa de 20% no valor do Contrato.')]),
                linha(),

                clausula('CLÁUSULA DÉCIMA QUARTA - CANCELAMENTO'),
                corpo([t('14.1 - Comunicada intenção de rescisão por uma das partes, deverá a CONTRATADA restituir os valores pagos até o momento pela CONTRATANTE em até 10 dias. Caso parte desistente seja a CONTRATADA, os valores deverão ser restituídos atualizados pelo IPCA + juros 1% ao mês.')]),
                linha(),

                clausula('CLÁUSULA DÉCIMA QUINTA – CONFIDENCIALIDADE'),
                corpo([t('15.1 – As Partes reconhecem que poderão receber ou ter a posse de certas informações e documentos confidenciais durante o prazo de validade deste contrato. As Partes expressamente acordam em não divulgar, revelar ou fornecer, seja no todo ou em parte, as Informações Confidenciais a terceiros, a não ser que expressamente autorizada por escrito pela outra Parte.')]),
                corpo([t('15.2 – A CONTRATADA deverá assegurar que a eventual coleta, tratamento, armazenamento e posterior eliminação de dados de terceiros seguirão o rigor da Lei Geral de Proteção de Dados (Lei 13.709/2018).')]),
                linha(),

                clausula('CLÁUSULA DÉCIMA SEXTA – FORO'),
                corpo([t('16.1 – Para dirimir quaisquer dúvidas oriundas do presente contrato as partes elegem o foro central da Capital do Estado de São Paulo.')]),
                linha(),

                corpo([t('E por estarem assim justas e contratadas firmam o presente instrumento em 02 (duas) vias de igual teor e forma, para um só fim de direito.')]),
                linha(),
                corpo([t(`São Paulo, ${dataGeracao || new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}.`)]),
                linha(),
                linha(),

                // ── Assinatura CONTRATANTE ────────────────────────────────
                linhaAssinatura(),
                corpo([bold(`${nomeEmpresa || 'CONTRATANTE'}`)]),
                ...(documentoCliente ? [corpo([t(documentoCliente)])] : []),
                ...(responsavel ? [corpo([t(`Representante: ${responsavel}`)])] : []),
                linha(),

                // ── Assinatura INTERMEDIADORA (só se houver agência) ──────
                ...(agencia ? [
                    linhaAssinatura(),
                    corpo([bold(agencia.nomeEmpresa)]),
                    ...(documentoAgencia ? [corpo([t(documentoAgencia)])] : []),
                    ...(agencia.responsavel ? [corpo([t(`Representante: ${agencia.responsavel}`)])] : []),
                    linha(),
                ] : []),

                // ── Assinatura CONTRATADA ─────────────────────────────────
                linhaAssinatura(),
                corpo([bold('DICA SOLUÇÕES CENOGRAFIA')]),
                corpo([t('CNPJ.: 44.343.918/0001-09')]),
                linha(),
                linha(),

                // ── Testemunhas ───────────────────────────────────────────
                ...blocoTestemunha(testemunha1Nome, testemunha1Cpf),
                linha(),
                ...blocoTestemunha(testemunha2Nome, testemunha2Cpf),
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

gerarContrato(JSON.parse(dadosJSON), outputPath)
    .then(() => process.exit(0))
    .catch(err => { console.error(err.message); process.exit(1); });