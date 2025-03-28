import React, { useEffect, useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import "./App.css";

const isMobile = window.innerWidth <= 768;




const CustomTooltip = ({ active, label, payload, selectedGreek, secondaryGreek }) => {
  if (!active || !payload || payload.length === 0) return null;
  
  const tooltipStyle = {
    backgroundColor: 'white',
    padding: '10px',
    border: '2px solid #888',
    borderRadius: '8px',
    boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
    fontWeight: 'bold',
  };

  return (
    <div style={tooltipStyle}>
      <p style={{ margin: '4px 0' }}>
        Valeur de S : <strong>{label}</strong>
      </p>
      {payload.map((entry, index) => {
        const greekLabel = entry.dataKey === "greekLeft" ? selectedGreek : secondaryGreek;
        return (
          <p key={index} style={{ margin: '4px 0' }}>
            Valeur du {greekLabel} : <strong>{entry.value.toFixed(4)}</strong>
          </p>
        );
      })}
    </div>
  );
};







const App = () => {
  // États de sélection
  const [optionType, setOptionType] = useState("call");
  const [selectedGreek, setSelectedGreek] = useState("Delta");
  const [param, setParam] = useState("sigma");
  const [secondaryGreek, setSecondaryGreek] = useState(null);

  // Plages par défaut pour le slider
  const paramRanges = useMemo(() => ({
    K: [0, 200],
    sigma: [0.0, 1.0],
    r: [0, 0.2],
    T: [0, 2],
  }), []);

  const [values, setValues] = useState({ K: 100, sigma: 0.2, r: 0.05, T: 1.0 });
  const [paramRange, setParamRange] = useState([0, 2]);

  // Données pour la courbe principale et secondaire
  const [xAxisValues, setXAxisValues] = useState([]);
  const [greekData, setGreekData] = useState({});
  const [xAxisValues2, setXAxisValues2] = useState([]);
  const [greekData2, setGreekData2] = useState({});
  const [loading, setLoading] = useState(false);
  const [allData, setAllData] = useState(null);
  const [priceData, setPriceData] = useState(null);

  // Chargement des JSON
  useEffect(() => {
    fetch("/greeks_all_combinations.json")
      .then(response => {
        if (!response.ok) throw new Error("Erreur lors du chargement du JSON");
        return response.json();
      })
      .then(data => setAllData(data))
      .catch(error => console.error("Erreur:", error));
  }, []);

  useEffect(() => {
    fetch("/option_prices.json")
      .then(response => {
        if (!response.ok) throw new Error("Erreur lors du chargement du JSON des prix");
        return response.json();
      })
      .then(data => setPriceData(data))
      .catch(error => console.error("Erreur:", error));
  }, []);

  useEffect(() => {
    const [minVal, maxVal] = paramRanges[param] || [0, 1];
    setParamRange([minVal, maxVal]);
  }, [param, paramRanges]);

  useEffect(() => {
    if (allData) {
      const branch = allData[optionType]?.[param]?.[selectedGreek];
      if (branch) {
        setXAxisValues(branch.S0_values);
        setGreekData(branch.curves);
      } else {
        setXAxisValues([]);
        setGreekData({});
      }
    }
  }, [allData, optionType, param, selectedGreek]);

  useEffect(() => {
    if (allData && secondaryGreek) {
      const branch2 = allData[optionType]?.[param]?.[secondaryGreek];
      if (branch2) {
        setXAxisValues2(branch2.S0_values);
        setGreekData2(branch2.curves);
      } else {
        setXAxisValues2([]);
        setGreekData2({});
      }
    }
  }, [allData, optionType, param, secondaryGreek]);

  const getGlobalYDomain = (data) => {
    let globalMin = Infinity, globalMax = -Infinity;
    Object.values(data).forEach(curve => {
      curve.forEach(val => {
        if (val < globalMin) globalMin = val;
        if (val > globalMax) globalMax = val;
      });
    });
    return [globalMin, globalMax];
  };

  const getClosestParamKey = (value, keys) => {
    return keys.reduce((a, b) =>
      Math.abs(a - value) < Math.abs(b - value) ? a : b
    );
  };

  let optionPrice = null;
  if (priceData && priceData[optionType]?.[param]) {
    const data = priceData[optionType][param];
    const numericKeys = Object.keys(data.prices).map(Number);
    const selectedKey = getClosestParamKey(values[param], numericKeys);
    const keyStr = selectedKey.toFixed(2).replace(/\.?0+$/, "");
    optionPrice = data.prices[keyStr];
  }

  let chartData = [];
  if (Object.keys(greekData).length > 0 && xAxisValues.length > 0) {
    const numericKeys = Object.keys(greekData).map(Number);
    const selectedKey = getClosestParamKey(values[param], numericKeys);
    const selectedKeyStr = selectedKey.toFixed(2).replace(/\.?0+$/, "");
    let selectedCurve = greekData[selectedKeyStr];
    if (selectedCurve) {
      if (selectedGreek === "Rho") {
        if (optionType === "put") {
          if (param === "K" || param === "T") {
            selectedCurve = selectedCurve.map(val =>
              (val < -2 || val > 0) ? undefined : val
            );
          } else if (param === "sigma" || param === "r") {
            selectedCurve = selectedCurve.map(val =>
              (val < -1 || val > 0) ? undefined : val
            );
          }
        } else {
          if (param === "K" || param === "T") {
            selectedCurve = selectedCurve.map(val =>
              (val < 0 || val > 2) ? undefined : val
            );
          } else if (param === "sigma" || param === "r") {
            selectedCurve = selectedCurve.map(val =>
              (val < 0 || val > 1) ? undefined : val
            );
          }
        }
      }
      chartData = xAxisValues.map((S0, i) => ({
        S0,
        greekLeft: selectedCurve[i],
      })).filter(point => point.greekLeft !== undefined);
    }
  }

  const greekValueAt100 = chartData.find(point => point.S0 === 100)?.greekLeft;

  let chartData2 = [];
  if (secondaryGreek && Object.keys(greekData2).length > 0 && xAxisValues2.length > 0) {
    const numericKeys2 = Object.keys(greekData2).map(Number);
    const selectedKey2 = getClosestParamKey(values[param], numericKeys2);
    const selectedKeyStr2 = selectedKey2.toFixed(2).replace(/\.?0+$/, "");
    let selectedCurve2 = greekData2[selectedKeyStr2];
    if (selectedCurve2) {
      if (secondaryGreek === "Rho") {
        if (optionType === "put") {
          if (param === "K" || param === "T") {
            selectedCurve2 = selectedCurve2.map(val =>
              (val < -2 || val > 0) ? undefined : val
            );
          } else if (param === "sigma" || param === "r") {
            selectedCurve2 = selectedCurve2.map(val =>
              (val < -1 || val > 0) ? undefined : val
            );
          }
        } else {
          if (param === "K" || param === "T") {
            selectedCurve2 = selectedCurve2.map(val =>
              (val < 0 || val > 2) ? undefined : val
            );
          } else if (param === "sigma" || param === "r") {
            selectedCurve2 = selectedCurve2.map(val =>
              (val < 0 || val > 1) ? undefined : val
            );
          }
        }
      }
      chartData2 = xAxisValues2.map((S0, i) => ({
        S0,
        greekRight: selectedCurve2[i],
      })).filter(point => point.greekRight !== undefined);
    }
  }

  let mergedData = [];
  if (secondaryGreek) {
    const dataMap = {};
    chartData.forEach(item => {
      dataMap[item.S0] = { S0: item.S0, greekLeft: item.greekLeft };
    });
    chartData2.forEach(item => {
      dataMap[item.S0] = { ...dataMap[item.S0], S0: item.S0, greekRight: item.greekRight };
    });
    mergedData = Object.values(dataMap).sort((a, b) => a.S0 - b.S0);
  } else {
    mergedData = chartData;
  }

  const greek2ValueAt100 = secondaryGreek
    ? chartData2.find(point => point.S0 === 100)?.greekRight
    : undefined;

  const yAxisPropsLeft = (() => {
    let props = {
      yAxisId: "left",
      orientation: "left",
      label: {
        value: selectedGreek,
        angle: -90,
        position: "insideLeft",
        style: { fontWeight: "bold", fill: "rgba(66,133,244,0.8)" }
      },
    };
    if (selectedGreek === "Rho") {
      if (optionType === "put") {
        if (param === "K" || param === "T") {
          props = { ...props, domain: [-2, 0], ticks: [-2, -1.5, -1, -0.5, 0] };
        } else if (param === "sigma" || param === "r") {
          props = { ...props, domain: [-1, 0], ticks: [-1, -0.75, -0.5, -0.25, 0] };
        }
      } else {
        if (param === "K" || param === "T") {
          props = { ...props, domain: [0, 2], ticks: [0, 0.5, 1, 1.5, 2] };
        } else if (param === "sigma" || param === "r") {
          props = { ...props, domain: [0, 1], ticks: [0, 0.25, 0.5, 0.75, 1] };
        }
      }
    } else if (selectedGreek === "Theta") {
      props = { ...props, domain: [-0.06, 0.05], ticks: [-0.05, -0.025, 0, 0.025, 0.05] };
    } else if (selectedGreek === "Vega") {
      props = { ...props, domain: [0, 0.8], ticks: [0, 0.2, 0.4, 0.6, 0.8] };
    } else if (selectedGreek === "Gamma") {
      props = { ...props, domain: [0, 0.15] };
    } else {
      props = { ...props, domain: Object.keys(greekData).length > 0 ? getGlobalYDomain(greekData) : [0, "auto"] };
    }
    return props;
  })();

  const yAxisPropsRight = (() => {
    if (!secondaryGreek) return {};
    let props = {
      yAxisId: "right",
      orientation: "right",
      label: {
        value: secondaryGreek,
        angle: 90,
        position: "insideRight",
        style: { fontWeight: "bold", fill: "#ff6600" }
      },
    };
    if (secondaryGreek === "Rho") {
      if (optionType === "put") {
        if (param === "K" || param === "T") {
          props = { ...props, domain: [-2, 0], ticks: [-2, -1.5, -1, -0.5, 0] };
        } else if (param === "sigma" || param === "r") {
          props = { ...props, domain: [-1, 0], ticks: [-1, -0.75, -0.5, -0.25, 0] };
        }
      } else {
        if (param === "K" || param === "T") {
          props = { ...props, domain: [0, 2], ticks: [0, 0.5, 1, 1.5, 2] };
        } else if (param === "sigma" || param === "r") {
          props = { ...props, domain: [0, 1], ticks: [0, 0.25, 0.5, 0.75, 1] };
        }
      }
    } else if (secondaryGreek === "Theta") {
      props = { ...props, domain: [-0.06, 0.05], ticks: [-0.05, -0.025, 0, 0.025, 0.05] };
    } else if (secondaryGreek === "Vega") {
      props = { ...props, domain: [0, 0.8], ticks: [0, 0.2, 0.4, 0.6, 0.8] };
    } else if (secondaryGreek === "Gamma") {
      props = { ...props, domain: [0, 0.15] };
    } else {
      props = { ...props, domain: Object.keys(greekData2).length > 0 ? getGlobalYDomain(greekData2) : [0, "auto"] };
    }
    return props;
  })();

  let verticalAsymptoteXLeft = null;
  if (selectedGreek === "Theta" && param === "T" && values[param] < 0.02) {
    verticalAsymptoteXLeft = xAxisValues.length > 0 ? xAxisValues[Math.floor(xAxisValues.length / 2)] : 100;
  } else if (selectedGreek === "Gamma") {
    if (param === "K" && values[param] === 0) {
      verticalAsymptoteXLeft = 0;
    } else if (param === "sigma" && values[param] === 0) {
      verticalAsymptoteXLeft = 95;
    } else if (param === "T" && values[param] === 0) {
      verticalAsymptoteXLeft = 100;
    }
  }
  let verticalAsymptoteXRight = null;
  if (secondaryGreek) {
    if (secondaryGreek === "Theta" && param === "T" && values[param] < 0.02) {
      verticalAsymptoteXRight = xAxisValues2.length > 0 ? xAxisValues2[Math.floor(xAxisValues2.length / 2)] : 100;
    } else if (secondaryGreek === "Gamma") {
      if (param === "K" && values[param] === 0) {
        verticalAsymptoteXRight = 0;
      } else if (param === "sigma" && values[param] === 0) {
        verticalAsymptoteXRight = 95;
      } else if (param === "T" && values[param] === 0) {
        verticalAsymptoteXRight = 100;
      }
    }
  }

  const handleSliderChange = (e) => {
    const newVal = parseFloat(e.target.value);
    setValues(prev => ({ ...prev, [param]: newVal }));
  };

  return (
    <div className="container">
      {/* Customisation du thumb du slider via un style global dans App.css */}
      
      {/* Panneau de contrôle */}
      <div className="control-panel">
        {/* En-tête avec logo et titre */}
        <div className="header">
          <img
            src="/logo.png"
            alt="Logo"
            style={{ width: "100px", borderRadius: "1%" }}
          />
          <h1 style={{ fontSize: "45px", fontWeight: "bold", margin: 0 }}>
            Greek Vision
          </h1>
        </div>

        <div className="option-buttons">
          <button
            onClick={() => setOptionType("call")}
            style={{
              padding: "8px 15px",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "bold",
              backgroundColor: optionType === "call" ? "rgba(66,133,244,0.8)" : "white",
              border: "1px solid #ccc",
              cursor: "pointer"
            }}
            disabled={loading}
          >
            CALL
          </button>
          <button
            onClick={() => setOptionType("put")}
            style={{
              padding: "8px 15px",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "bold",
              backgroundColor: optionType === "put" ? "rgba(66,133,244,0.8)" : "white",
              border: "1px solid #ccc",
              cursor: "pointer"
            }}
            disabled={loading}
          >
            PUT
          </button>
        </div>

        <div className="param-section">
          <p className="section-title">Paramètre à faire varier :</p>
          <div className="param-buttons">
            {["K", "sigma", "r", "T"].map(p => (
              <div key={p} className="param-row">
                <button
                  onClick={() => {
                    setParam(p);
                    setValues({ K: 100, sigma: 0.2, r: 0.05, T: 1.0 });
                  }}
                  style={{
                    width: "40%",
                    padding: "8px",
                    fontSize: "14px",
                    fontWeight: "bold",
                    backgroundColor: param === p ? "rgba(66,133,244,0.8)" : "white",
                    border: "1px solid #ccc",
                    borderRadius: "8px",
                    cursor: "pointer"
                  }}
                  disabled={loading}
                >
                  {p}
                </button>
                <div className="value-box">
                  {values[p].toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="greek-section">
          <p className="section-title">Choisir le Greek :</p>
          <div className="greek-buttons">
            {["Delta", "Gamma", "Vega", "Theta", "Rho"].map(g => (
              <button
                key={g}
                onClick={() => setSelectedGreek(g)}
                style={{
                  padding: "8px 15px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "bold",
                  backgroundColor: selectedGreek === g ? "rgba(66,133,244,0.8)" : "white",
                  border: "1px solid #ccc",
                  cursor: "pointer"
                }}
                disabled={loading}
              >
                {g}
              </button>
            ))}
          </div>
          <div className="secondary-greek">
            {secondaryGreek ? (
              <button
                onClick={() => setSecondaryGreek(null)}
                style={{
                  padding: "6px 10px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: "bold",
                  backgroundColor: "#eee",
                  border: "1px solid #ccc",
                  cursor: "pointer"
                }}
              >
                Supprimer le second Greek
              </button>
            ) : (
              <button
                onClick={() => setSecondaryGreek("Delta")}
                style={{
                  padding: "6px 10px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: "bold",
                  backgroundColor: "#eee",
                  border: "1px solid #ccc",
                  cursor: "pointer"
                }}
              >
                Ajouter second Greek
              </button>
            )}
          </div>
          {secondaryGreek && (
            <div className="secondary-greek-choose">
              <p className="section-title">Choisir le second Greek :</p>
              <div className="greek-buttons">
                {["Delta", "Gamma", "Vega", "Theta", "Rho"].map(g => (
                  <button
                    key={g}
                    onClick={() => setSecondaryGreek(g)}
                    style={{
                      padding: "8px 15px",
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontWeight: "bold",
                      backgroundColor: secondaryGreek === g ? "#ff6600" : "white",
                      border: "1px solid #ccc",
                      cursor: "pointer"
                    }}
                    disabled={loading}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Panneau d'affichage */}
      <div className="display-panel">
        {optionPrice !== null && (
          <p className="option-price">
            Prix du {optionType.toUpperCase()}  pour S = 100 : {optionPrice}
          </p>
        )}
        {greekValueAt100 !== undefined && (
          <p className="greek-value">
            {selectedGreek} pour S = 100 : {greekValueAt100.toFixed(2)}
          </p>
        )}
        {secondaryGreek && greek2ValueAt100 !== undefined && (
          <p className="greek-value secondary">
            {secondaryGreek} pour S = 100 : {greek2ValueAt100.toFixed(2)}
          </p>
        )}
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={mergedData}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="S0"
              domain={[0, 200]}
              ticks={Array.from({ length: 21 }, (_, i) => i * 10)}
              label={{
                value: "Prix du sous-jacent",
                position: "insideBottom",
                offset: -2,
                style: { fontWeight: "bold" }
              }}
            />
            <YAxis {...yAxisPropsLeft} />
            {secondaryGreek && <YAxis {...yAxisPropsRight} />}
            <Tooltip content={<CustomTooltip selectedGreek={selectedGreek} secondaryGreek={secondaryGreek} />} />
            {verticalAsymptoteXLeft !== null ? (
              <ReferenceLine
                x={verticalAsymptoteXLeft}
                yAxisId="left"
                stroke="rgba(66,133,244,0.8)"
                strokeDasharray="3 3"
                strokeWidth={3}
              />
            ) : (
              <Line
                type="basis"
                yAxisId="left"
                dataKey="greekLeft"
                stroke="rgba(66,133,244,0.8)"
                dot={false}
                strokeWidth={2.5}
              />
            )}
            {secondaryGreek &&
              (verticalAsymptoteXRight !== null ? (
                <ReferenceLine
                  x={verticalAsymptoteXRight}
                  yAxisId="right"
                  stroke="#ff6600"
                  strokeDasharray="3 3"
                  strokeWidth={3}
                />
              ) : (
                <Line
                  type="basis"
                  yAxisId="right"
                  dataKey="greekRight"
                  stroke="#ff6600"
                  dot={false}
                  strokeWidth={2.5}
                />
              ))}
          </LineChart>
        </ResponsiveContainer>  
        <div className="slider-container">
          <input
            type="range"
            min={paramRange[0]}
            max={paramRange[1]}
            step={(paramRange[1] - paramRange[0]) / 100}
            value={values[param]}
            onChange={handleSliderChange}
            disabled={loading}
          />
          <div className="slider-value">
            {param}: {values[param].toFixed(2)}
          </div>
          <div className="slider-range">
            <span>{paramRange[0]}</span>
            <span>{paramRange[1]}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App