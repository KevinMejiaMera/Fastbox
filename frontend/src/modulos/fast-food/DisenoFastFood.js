import React from 'react';
import BarraLateralFastFood from './BarraLateralFastFood';

const DisenoFastFood = ({ children }) => {
    return (
        <div className="layout">
            <div className="layout-body">
                <BarraLateralFastFood />
                <main className="main-content">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default DisenoFastFood;
