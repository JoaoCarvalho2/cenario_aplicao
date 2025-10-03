import React, { useState } from 'react';
import ScenarioList from './components/ScenarioList';
import ScenarioEditor from './components/ScenarioEditor';
import './index.css';

function App() {
    const [selectedScenarioId, setSelectedScenarioId] = useState(null);

    const handleSelectScenario = (id) => {
        setSelectedScenarioId(id);
    };

    const handleBackToList = () => {
        setSelectedScenarioId(null);
    };

    return (
        <div className="container">
            <header>
                <h1>Gerador de Cenários Financeiros</h1>
            </header>
            <main>
                {selectedScenarioId ? (
                    <ScenarioEditor scenarioId={selectedScenarioId} onBack={handleBackToList} />
                ) : (
                    <ScenarioList onSelectScenario={handleSelectScenario} />
                )}
            </main>
        </div>
    );
}

export default App;