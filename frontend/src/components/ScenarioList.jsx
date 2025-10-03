// frontend/src/components/ScenarioList.jsx

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

// URL base da sua API backend.
const API_URL = 'http://localhost:4000/api';

function ScenarioList({ onSelectScenario }) {
    const [scenarios, setScenarios] = useState([]);
    const [newScenarioName, setNewScenarioName] = useState('');
    const [isUploading, setIsUploading] = useState(false); // Estado para controlar o loading do upload

    // Cria uma referência para o elemento <input type="file"> escondido.
    // Isso nos permite acioná-lo a partir de um clique em outro botão.
    const fileInputRef = useRef(null);

    /**
     * Busca a lista de todos os cenários salvos no backend.
     */
    const fetchScenarios = async () => {
        try {
            const response = await axios.get(`${API_URL}/scenarios`);
            setScenarios(response.data.data);
        } catch (error) {
            console.error("Erro ao buscar cenários:", error);
            alert("Não foi possível carregar os cenários salvos.");
        }
    };

    // O useEffect com array vazio faz com que a função fetchScenarios
    // seja chamada uma única vez, quando o componente é montado na tela.
    useEffect(() => {
        fetchScenarios();
    }, []);

    /**
     * Lida com a criação de um novo cenário em branco.
     */
    const handleCreate = async () => {
        if (!newScenarioName.trim()) {
            alert('Por favor, insira um nome para o novo cenário.');
            return;
        }
        try {
            await axios.post(`${API_URL}/scenarios`, {
                name: newScenarioName,
                margin: 0.15, // Valor padrão para margem
                dollar_rate: 5.20, // Valor padrão para cotação do dólar
                products: []
            });
            setNewScenarioName(''); // Limpa o campo de texto
            fetchScenarios(); // Atualiza a lista para mostrar o novo cenário
        } catch (error) {
            console.error("Erro ao criar cenário:", error);
            alert("Falha ao criar o cenário. Verifique se já não existe um com o mesmo nome.");
        }
    };

    /**
     * Lida com a exclusão de um cenário existente.
     */
    const handleDelete = async (id) => {
        if (window.confirm('Tem certeza que deseja excluir este cenário? Esta ação não pode ser desfeita.')) {
            try {
                await axios.delete(`${API_URL}/scenarios/${id}`);
                fetchScenarios(); // Atualiza a lista
            } catch (error) {
                console.error("Erro ao excluir cenário:", error);
                alert("Falha ao excluir o cenário.");
            }
        }
    };
    
    /**
     * Lida com a duplicação de um cenário.
     */
    const handleDuplicate = async (id) => {
        try {
            await axios.post(`${API_URL}/scenarios/${id}/duplicate`);
            fetchScenarios(); // Atualiza a lista para mostrar o cenário duplicado
        } catch (error) {
            console.error("Erro ao duplicar cenário:", error);
            alert("Falha ao duplicar o cenário.");
        }
    };

    /**
     * Acionado quando um arquivo PDF é selecionado pelo usuário.
     * Envia o arquivo para o backend para processamento.
     */
    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) {
            return; // Nenhum arquivo selecionado
        }

        // FormData é o formato padrão para enviar arquivos em requisições HTTP
        const formData = new FormData();
        formData.append('quotePdf', file); // 'quotePdf' é a chave que o backend (multer) espera

        setIsUploading(true); // Ativa o estado de "carregando"
        try {
            await axios.post(`${API_URL}/scenarios/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            fetchScenarios(); // Atualiza a lista com o novo cenário criado a partir do PDF
        } catch (error) {
            console.error("Erro no upload do PDF:", error);
            // Mostra a mensagem de erro específica vinda do backend, se houver
            alert(error.response?.data?.error || "Falha ao processar o PDF.");
        } finally {
            setIsUploading(false); // Desativa o estado de "carregando"
            // Limpa o valor do input para que o usuário possa selecionar o mesmo arquivo novamente
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    /**
     * Aciona o clique no input de arquivo escondido.
     */
    const triggerFileUpload = () => {
        fileInputRef.current.click();
    };

    return (
        <div className="scenario-list">
            <h2>Cenários Salvos</h2>
            <div className="create-scenario">
                <input
                    type="text"
                    value={newScenarioName}
                    onChange={(e) => setNewScenarioName(e.target.value)}
                    placeholder="Nome do Novo Cenário (ex: Samsung)"
                    onKeyUp={(e) => e.key === 'Enter' && handleCreate()}
                />
                <button onClick={handleCreate}>Criar Novo Cenário</button>
                
                {/* Input de arquivo escondido, controlado pela referência 'fileInputRef' */}
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    style={{ display: 'none' }}
                    accept=".pdf"
                />
                
                {/* Botão que o usuário realmente vê e clica para fazer o upload */}
                <button onClick={triggerFileUpload} disabled={isUploading} className="upload-btn">
                    {isUploading ? 'Processando PDF...' : 'Importar de PDF'}
                </button>
            </div>
            <ul>
                {scenarios.length > 0 ? (
                    scenarios.map(s => (
                        <li key={s.id}>
                            <span>{s.name}</span>
                            <div className="actions">
                                <button onClick={() => onSelectScenario(s.id)}>Abrir</button>
                                <button onClick={() => handleDuplicate(s.id)}>Duplicar</button>
                                <button className="delete" onClick={() => handleDelete(s.id)}>Excluir</button>
                            </div>
                        </li>
                    ))
                ) : (
                    <p>Nenhum cenário criado ainda. Crie um novo ou importe um PDF.</p>
                )}
            </ul>
        </div>
    );
}

export default ScenarioList;