import { IfcViewerAPI } from 'web-ifc-viewer';

// Referencia o contêiner e o input de arquivo do HTML
const container = document.getElementById('viewer-container');
const input = document.getElementById('file-input');

// Inicializa a IfcViewerAPI no contêiner
const viewer = new IfcViewerAPI({ container });

// Configura o visualizador para exibir eixos e grade
viewer.axes.setAxes();
viewer.grid.setGrid();

// Adiciona um evento para o input de arquivo
input.addEventListener("change", async (changed) => {
  const ifcURL = URL.createObjectURL(changed.target.files[0]);
  await viewer.IFC.loadIfcUrl(ifcURL);
});

// Adiciona um evento de clique para seleção
window.ondblclick = () => viewer.pickIfcItem();
