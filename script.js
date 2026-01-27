const pedidos = {
  300: [],
  500: [],
  pote: []
};

function alterarQtd(tipo, valor) {
  const qtdEl = document.getElementById(`qtd-${tipo}`);
  let qtd = parseInt(qtdEl.innerText);

  qtd = Math.max(0, qtd + valor);
  qtdEl.innerText = qtd;

  if (valor === 1) adicionarItem(tipo);
  if (valor === -1) removerItem(tipo);
}

function adicionarItem(tipo) {
  const container = document.getElementById(`itens-${tipo}`);
  const index = pedidos[tipo].length + 1;

  const div = document.createElement('div');
  div.className = 'acai-item';

  div.innerHTML = `
    <strong>Açaí ${index}</strong>
    <label><input type="checkbox"> Leite condensado</label>
    <label><input type="checkbox"> Creme de avelã</label>
    <label><input type="checkbox"> Calda de morango</label>
    <label><input type="checkbox"> Leite em pó</label>
    <label><input type="checkbox"> Chocoball</label>
    <label><input type="checkbox"> Confetes</label>
    <label><input type="checkbox"> Acompanhar talher</label>
  `;

  container.appendChild(div);
  pedidos[tipo].push(div);
}

function removerItem(tipo) {
  const container = document.getElementById(`itens-${tipo}`);
  if (container.lastChild) {
    container.removeChild(container.lastChild);
    pedidos[tipo].pop();
  }
}

function finalizarPedido() {
  let mensagem = "🍧 *Pedido PJ AÇAÍ*%0A%0A";

  ['300', '500', 'pote'].forEach(tipo => {
    pedidos[tipo].forEach((item, i) => {
      mensagem += `Açaí ${tipo}ml #${i + 1}%0A`;
      item.querySelectorAll('input:checked').forEach(op => {
        mensagem += `- ${op.parentElement.innerText}%0A`;
      });
      mensagem += `%0A`;
    });
  });

  const endereco = document.getElementById('endereco').value;
  mensagem += `📍 Endereço: ${endereco}%0A`;
  mensagem += `💳 Pagamento: Pix`;

  window.open(
    "https://wa.me/5541995647320?text=" + mensagem,
    "_blank"
  );
}