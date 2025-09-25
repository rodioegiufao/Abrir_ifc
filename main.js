import { IfcViewerAPI } from 'web-ifc-viewer';

// Aguarda o DOM carregar completamente
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const container = document.getElementById('viewer-container');
    const input = document.getElementById('file-input');

    if (!container || !input) {
      throw new Error('Elementos do DOM não encontrados');
    }

    // Inicializa a IfcViewerAPI no contêiner
    const viewer = new IfcViewerAPI({ 
      container,
      backgroundColor: '#f0f0f0'
    });

    // Configura o visualizador
    viewer.axes.setAxes();
    viewer.grid.setGrid();

    // Adiciona evento para carregar arquivos IFC
    input.addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      try {
        const ifcURL = URL.createObjectURL(file);
        await viewer.IFC.loadIfcUrl(ifcURL);
        URL.revokeObjectURL(ifcURL); // Limpa memória
      } catch (error) {
        console.error('Erro ao carregar arquivo IFC:', error);
        alert('Erro ao carregar arquivo IFC. Verifique se o arquivo é válido.');
      }
    });

    // Adiciona evento de duplo clique para seleção
    window.ondblclick = () => {
      try {
        viewer.pickIfcItem();
      } catch (error) {
        console.error('Erro na seleção:', error);
      }
    };

    console.log('Visualizador IFC inicializado com sucesso!');
    
  } catch (error) {
    console.error('Erro na inicialização do visualizador:', error);
  }
});
