import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:4000/api';
const IOF_RATE = 1.035;

function ScenarioEditor({ scenarioId, onBack }) {
    const [scenario, setScenario] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchScenarioData = async () => {
            setIsLoading(true);
            try {
                const response = await axios.get(`${API_URL}/scenarios/${scenarioId}`);
                setScenario(response.data.data);
            } catch (error) {
                console.error("Erro ao buscar dados do cenário:", error);
            }
            setIsLoading(false);
        };
        fetchScenarioData();
    }, [scenarioId]);

    // --- Funções de Cálculo ---
    const calculatedProducts = useMemo(() => {
        if (!scenario) return [];
        return scenario.products.map(p => {
            const baseValue = Number(p.base_value) || 0;
            const effectiveCost = baseValue * IOF_RATE;
            const priceUSD = scenario.margin < 1 ? effectiveCost / (1 - Number(scenario.margin)) : 0;
            const priceBRL = priceUSD * (Number(scenario.dollar_rate) || 0);
            return {
                ...p,
                effectiveCost,
                priceUSD,
                priceBRL
            };
        });
    }, [scenario]);

    const totals = useMemo(() => {
        const totalUSD = calculatedProducts.reduce((sum, p) => sum + p.priceUSD, 0);
        const totalBRL = calculatedProducts.reduce((sum, p) => sum + p.priceBRL, 0);
        return { totalUSD, totalBRL };
    }, [calculatedProducts]);

    // --- Handlers de Mudança ---
    const handleGlobalChange = (e) => {
        const { name, value } = e.target;
        setScenario(prev => ({ ...prev, [name]: value }));
    };
    
    const handleProductChange = (index, e) => {
        const { name, value } = e.target;
        const updatedProducts = [...scenario.products];
        updatedProducts[index] = { ...updatedProducts[index], [name]: value };
        setScenario(prev => ({ ...prev, products: updatedProducts }));
    };

    const handleAddProduct = () => {
        const newProduct = { id: `new-${Date.now()}`, name: 'Novo Produto', base_value: 0 };
        setScenario(prev => ({ ...prev, products: [...prev.products, newProduct] }));
    };

    const handleRemoveProduct = (index) => {
        const updatedProducts = scenario.products.filter((_, i) => i !== index);
        setScenario(prev => ({ ...prev, products: updatedProducts }));
    };
    
    const handleSave = async () => {
        try {
            // Filtra produtos que possam não ter ID de banco de dados ainda
            const productsToSave = scenario.products.map(({ name, base_value }) => ({ name, base_value }));
            const payload = { ...scenario, products: productsToSave };
            
            await axios.put(`${API_URL}/scenarios/${scenarioId}`, payload);
            alert('Cenário salvo com sucesso!');
        } catch (error) {
            console.error("Erro ao salvar cenário:", error);
            alert('Falha ao salvar o cenário.');
        }
    };
    
    // --- Funções de Exportação ---
    const exportToJSON = () => {
        const dataStr = JSON.stringify({ ...scenario, calculatedProducts, totals }, null, 4);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const exportFileDefaultName = `${scenario.name}.json`;
        
        let linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };


    if (isLoading) return <div>Carregando cenário...</div>;
    if (!scenario) return <div>Cenário não encontrado. <button onClick={onBack}>Voltar</button></div>;

    return (
        <div className="scenario-editor">
            <div className="editor-header">
                <button onClick={onBack}>&larr; Voltar para a Lista</button>
                <input type="text" name="name" value={scenario.name} onChange={handleGlobalChange} className="scenario-title-input"/>
                <button className="save-btn" onClick={handleSave}>Salvar Alterações</button>
            </div>

            <div className="global-settings">
                <div>
                    <label>Margem Geral (%):</label>
                    <input 
                        type="number"
                        name="margin"
                        value={scenario.margin * 100}
                        onChange={(e) => setScenario(prev => ({ ...prev, margin: e.target.value / 100 }))}
                        step="0.1"
                    />
                </div>
                <div>
                    <label>Cotação do Dólar (R$):</label>
                    <input 
                        type="number"
                        name="dollar_rate"
                        value={scenario.dollar_rate}
                        onChange={handleGlobalChange}
                        step="0.01"
                    />
                </div>
            </div>

            <table className="products-table">
                <thead>
                    <tr>
                        <th>Nome do Produto</th>
                        <th>Valor Base</th>
                        <th>Custo Efetivo (IOF)</th>
                        <th>Preço (USD)</th>
                        <th>Preço (R$)</th>
                        <th>Ação</th>
                    </tr>
                </thead>
                <tbody>
                    {calculatedProducts.map((p, index) => (
                        <tr key={p.id || index}>
                            <td><input type="text" name="name" value={p.name} onChange={(e) => handleProductChange(index, e)} /></td>
                            <td><input type="number" name="base_value" value={p.base_value} onChange={(e) => handleProductChange(index, e)} /></td>
                            <td>{p.effectiveCost.toFixed(2)}</td>
                            <td>$ {p.priceUSD.toFixed(2)}</td>
                            <td>R$ {p.priceBRL.toFixed(2)}</td>
                            <td><button className="delete" onClick={() => handleRemoveProduct(index)}>Remover</button></td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <button onClick={handleAddProduct}>Adicionar Produto</button>

            <div className="totals">
                <h3>Total em USD: $ {totals.totalUSD.toFixed(2)}</h3>
                <h3>Total em R$: R$ {totals.totalBRL.toFixed(2)}</h3>
            </div>

            <div className="export-section">
                <button onClick={exportToJSON}>Exportar para JSON</button>
            </div>
        </div>
    );
}

export default ScenarioEditor;