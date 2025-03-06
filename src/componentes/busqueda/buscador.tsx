import { useState, useEffect, useCallback } from 'react';
import { FiPrinter, FiDownload, FiX, FiTrash2, FiChevronDown, FiChevronRight,FiMenu } from "react-icons/fi";
import './Search.css';
import jsPDF from 'jspdf';

export interface Property {
    _id: string;
    Codigo: string;
    Departamento: string;
    Municipio: string;
    Tipo: string;
    Barrio: string;
    Area: number;
    Caracteristicas: string[];
    "Precio de lista": number;
}

export interface ContactInfo {
    marca: string;
    direccion: string;
    telefono: string;
    email: string;
    "sitio web": string;
}

export interface CompanySuggestion {
    nombre_empresa: string;
    justificacion: string;
    contacto: ContactInfo;
}

interface SearchHistoryEntry {
    tipo: string;
    ciudad: string;
    date: string;
    id: string;
    properties?: Property[]; // Guardar propiedades de la búsqueda
    selectedProperty?: Property; // Propiedad seleccionada (si aplica)
    clientSuggestions?: ApiResponse; // Guardar sugerencias de clientes 
}

export interface ApiResponse {
    suggestions: CompanySuggestion[];
    error?: string;
}

// Static Data
const propertyTypes = [
    { value: 'Finca', label: 'Finca' },
    { value: 'Local', label: 'Local' }
];

const cities = [
    { value: 'bogota', label: 'Bogotá' },
    { value: 'medellin', label: 'Medellín' },
    { value: 'cali', label: 'Cali' },
    { value: 'barranquilla', label: 'Barranquilla' }
];

// Utility Functions
const formatCharacteristics = (caracteristicas: string | string[] | undefined): string[] => {
    if (!caracteristicas) return [];
    if (Array.isArray(caracteristicas)) return caracteristicas;
    if (typeof caracteristicas === 'string') {
        return caracteristicas.includes(',') ? 
            caracteristicas.split(',').map(item => item.trim()) : 
            [caracteristicas];
    }
    return [];
};
const useSearchHistory = () => {
    const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>(() => {
        // Intentar cargar el historial de búsquedas desde localStorage
        const storedHistory = localStorage.getItem('propertySearchHistory');
        return storedHistory ? JSON.parse(storedHistory) : [];
    });

    // Efecto para guardar el historial en localStorage cuando cambia
    useEffect(() => {
        localStorage.setItem('propertySearchHistory', JSON.stringify(searchHistory));
    }, [searchHistory]);

    // Método para agregar una nueva búsqueda al historial
    const addSearchToHistory = useCallback((tipo: string, ciudad: string, properties?: Property[], selectedProperty?: Property, clientSuggestions?: ApiResponse) => {
        const newSearch: SearchHistoryEntry = {
            tipo,
            ciudad,
            date: new Date().toLocaleString(),
            id: Date.now().toString(),
            properties,
            selectedProperty,
            clientSuggestions
            
        };

        setSearchHistory(currentHistory => {
            // Eliminar entradas duplicadas
            const filteredHistory = currentHistory.filter(
                entry => !(entry.tipo === tipo && entry.ciudad === ciudad)
            );

            // Agregar nueva búsqueda al inicio y limitar a 10 entradas
            return [newSearch, ...filteredHistory].slice(0, 10);
        });
    }, []);
    const updateSearchHistoryWithClientSuggestions = useCallback((
        tipo: string, 
        ciudad: string, 
        selectedProperty: Property,
        clientSuggestions: ApiResponse
    ) => {
        setSearchHistory(currentHistory => 
            currentHistory.map(entry => 
                entry.tipo === tipo && entry.ciudad === ciudad
                    ? {
                        ...entry,
                        selectedProperty,
                        clientSuggestions
                    }
                    : entry
            )
        );
    }, []);
    // Método para eliminar una entrada del historial
    const removeSearchHistoryItem = useCallback((id: string) => {
        setSearchHistory(prevHistory => 
            prevHistory.filter(entry => entry.id !== id)
        );
    }, []);

    // Método para limpiar todo el historial
    const clearSearchHistory = useCallback(() => {
        setSearchHistory([]);
    }, []);

    return {
        searchHistory,
        addSearchToHistory,
        removeSearchHistoryItem,
        clearSearchHistory,
        updateSearchHistoryWithClientSuggestions
    };
};

export default function PropertySearch() {
    // State Management
    const [filters, setFilters] = useState({ tipo: '', ciudad: '' });
    const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    // Suggestions States
    const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
    const [clientSuggestions, setClientSuggestions] = useState<ApiResponse | null>(null);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [suggestionError, setSuggestionError] = useState<string | null>(null);
     const [isSidebarVisible, setIsSidebarVisible] = useState(false);
     const { searchHistory, addSearchToHistory, removeSearchHistoryItem, clearSearchHistory,  updateSearchHistoryWithClientSuggestions } = useSearchHistory();

    const toggleRowExpand = (propertyId: string) => {
        setExpandedRows(prev => {
            const newSet = new Set(prev);
            newSet.has(propertyId) ? newSet.delete(propertyId) : newSet.add(propertyId);
            return newSet;
        });
    };

    const fetchFilteredProperties = async () => {
        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams({
                Tipo: filters.tipo.toLowerCase(),
                Municipio: filters.ciudad
            });

            const response = await fetch(`http://localhost:5000/api/inmuebles?${params}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            setFilteredProperties(data);

            if (data.length === 0) {
                setError('No se encontraron inmuebles con los criterios especificados.');
            }

            addSearchToHistory(filters.tipo, filters.ciudad, data );

        } catch (err) {
            setError(`Error en la búsqueda: ${err instanceof Error ? err.message : "Error desconocido"}`);
        } finally {
            setLoading(false);
        }   
    };

    // Fetch Client Suggestions
    const fetchClientSuggestions = async (property: Property) => {
        setLoadingSuggestions(true);
        setSuggestionError(null);
        setSelectedProperty(property);
        
        try {
            const response = await fetch('http://localhost:5000/api/suggest-clients', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({inmueble_id: property._id}),
            });
    
            if (!response.ok) throw new Error(`Error en la solicitud: ${response.status}`);
    
            const data: ApiResponse = await response.json();
            
            if (data.suggestions) {
                setClientSuggestions(data);
                
                updateSearchHistoryWithClientSuggestions(
                    filters.tipo,
                    filters.ciudad,
                    property,
                    data
                );
            } else {
                throw new Error('Formato de respuesta inválido');
            }
        } catch (error) {
            setSuggestionError(error instanceof Error ? error.message : 'Error al buscar sugerencias');
            setClientSuggestions(null);
        } finally {
            setLoadingSuggestions(false);
        }
    };

 // Método para recuperar una búsqueda histórica completa
 const recoverSearchFromHistory = (historyEntry: SearchHistoryEntry) => {
    // Restablecer filtros
    setFilters({
        tipo: historyEntry.tipo,
        ciudad: historyEntry.ciudad
    });

    // Restaurar propiedades encontradas
    if (historyEntry.properties) {
        setFilteredProperties(historyEntry.properties);
    }

    // Restaurar propiedad seleccionada y sugerencias
    if (historyEntry.selectedProperty) {
        setSelectedProperty(historyEntry.selectedProperty);
        
        if (historyEntry.clientSuggestions) {
            setClientSuggestions(historyEntry.clientSuggestions);
        }
    }
};

const handlePdfDownload = () => {
    if (!selectedProperty || !clientSuggestions?.suggestions) return;
  
    const pdf = new jsPDF();
    const pageHeight = pdf.internal.pageSize.height;
    const pageWidth = pdf.internal.pageSize.width;
    const margin = 10;
    let yPosition = 20;
  
    // Añadir el logo con ajuste de proporciones
    const logoUrl = `${window.location.origin}/logovitrina.png`;
  
    // Crear una imagen en un objeto de imagen HTML para obtener sus dimensiones
    const img = new Image();
    img.src = logoUrl;
  
    img.onload = () => {
      const imgWidth = 30; // Ancho reducido de la imagen
      const imgHeight = (img.height / img.width) * imgWidth; // Mantener proporción de la imagen
  
      pdf.addImage(logoUrl, 'PNG', 10, 10, imgWidth, imgHeight); // Ajustada a la esquina superior izquierda
  
      // Título del reporte
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.setTextColor(30, 30, 30);
      pdf.text('Reporte de Propiedad', pageWidth / 2, yPosition, { align: 'center' });
      pdf.setDrawColor(255, 165, 0); // Color naranja
      pdf.line(margin, yPosition + 5, pageWidth - margin, yPosition + 5); // Subrayado del título
      yPosition += 15;
  
      // Detalles de la propiedad
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(12);
  
      const propertyDetails = [
        `Código: ${selectedProperty.Codigo}`,
        `Tipo: ${selectedProperty.Tipo}`,
        `Departamento: ${selectedProperty.Departamento}`,
        `Municipio: ${selectedProperty.Municipio}`,
        `Barrio: ${selectedProperty.Barrio}`,
        `Área: ${selectedProperty.Area} m²`,
        `Precio: $ ${selectedProperty['Precio de lista']}`,
        `Características: ${selectedProperty.Caracteristicas}`,
      ];
  
      // Calcular el alto del cuadro de propiedad basado en las líneas generadas por splitTextToSize
      const textLines: string[] = [];
      const maxWidth = pageWidth - 2 * margin - 10;
      propertyDetails.forEach(detail => {
        const lines = pdf.splitTextToSize(detail, maxWidth);
        textLines.push(...lines);
      });
  
      // Ajustar la altura del cuadro de detalles de la propiedad
      const propertyDetailsHeight = textLines.length * 6 + 8; // Ajusta el multiplicador para cambiar el espaciado
  
      // Cuadro de propiedad con fondo gris claro
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, yPosition, pageWidth - 2 * margin, propertyDetailsHeight, 'F');
  
      textLines.forEach((line, index) => {
        pdf.text(line, margin + 5, yPosition + 8 + index * 6); // Ajusta el multiplicador para cambiar el espaciado
      });
  
      yPosition += propertyDetailsHeight + 15;
  
      // Sugerencias de Clientes
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(17);
      pdf.setTextColor(30, 30, 30);
      pdf.text('Sugerencias de Clientes', margin, yPosition);
      pdf.setDrawColor(255, 165, 0); // Color naranja
      pdf.line(margin, yPosition + 5, pageWidth - margin, yPosition + 5); // Subrayado del título
      yPosition += 15;
  
      const suggestionsToRender = clientSuggestions.suggestions;
  
      suggestionsToRender.forEach((suggestion, index) => {
        // Ajustar la altura del cuadro de sugerencias
        const suggestionHeight = 60; // Cambia este valor para ajustar la altura
  
        // Verificar si el cuadro de sugerencia cabe en la página actual
        if (yPosition + suggestionHeight > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
        }
  
        // Caja para la sugerencia del cliente con fondo gris claro
        pdf.setFillColor(240, 240, 240);
        pdf.rect(margin, yPosition, pageWidth - 2 * margin, suggestionHeight, 'F');
  
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.text(suggestion.nombre_empresa, margin + 5, yPosition + 10);
  
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(12);
        pdf.text(`Marca: ${suggestion.contacto.marca}`, margin + 5, yPosition + 20);
        pdf.text(`Dirección: ${suggestion.contacto.direccion}`, margin + 5, yPosition + 28);
        pdf.text(`Teléfono: ${suggestion.contacto.telefono}`, margin + 5, yPosition + 36);
        pdf.text(`Email: ${suggestion.contacto.email}`, margin + 5, yPosition + 44);
        pdf.text(`Sitio Web: ${suggestion.contacto["sitio web"]}`, margin + 5, yPosition + 52);
  
        yPosition += suggestionHeight + 10; // Espacio después de cada sugerencia
      });
  
      // Guardar el PDF
      pdf.save('reporte_propiedad.pdf');
    };
  };

    return (
        <div className={`container ${isSidebarVisible ? 'sidebar-open' : ''}`}>
            <div className='image'><img src="/LogoVitrina.png" alt="Logo" className="search-image" /></div>
             <div className="header">
                
                <button 
                    onClick={() => setIsSidebarVisible(!isSidebarVisible)} 
                    className="toggle-sidebar-btn"
                >
                    <FiMenu />
                </button>

               {/* <h3 className="title">Propiedades Disponibles</h3>*/}
            </div>

            
            <div className={`sidebar ${isSidebarVisible ? 'sidebar-open' : 'sidebar-closed'}`}>
                <div className="sidebar-header">
                    <h3>Historial de Búsquedas</h3>
                    <div className="sidebar-actions">
                    <button 
                    onClick={clearSearchHistory} 
                    className="clear-history-btn"
                >
                    <FiTrash2 />
                </button>
                        <button 
                            onClick={() => setIsSidebarVisible(false)}
                            className="close-sidebar-btn"
                        >
                            <FiX />
                        </button>
                    </div>
                </div>

                <div className="sidebar-content">
                    {searchHistory.length === 0 ? (
                        <p className="empty-history">No hay búsquedas recientes</p>
                    ) : (
                        searchHistory.map((entry, index) => (
                            <div
                             key={entry.id} 
                             className="history-item"
                             onClick={() => recoverSearchFromHistory(entry)}
                             >
                                <div className="history-item-header">
                                    <h4>{entry.tipo} - {entry.ciudad}</h4>
                                    <button 
                        onClick={(e) => {
                            e.stopPropagation();  // Prevent recovering search when removing
                            removeSearchHistoryItem(entry.id);
                        }} 
                        className="remove-item-btn"
                    >
                        <FiX />
                    </button>
                                </div>
                                <p className="history-item-date">
                                    {entry.date}
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </div>

            
            <div className="container-1">
            
                <h3 className="title">Propiedades Disponibles</h3>
                
                <div className="container-filters">
                    <label className="Titles-two">Tipo de Inmueble:</label>
                        <div className='select'>
                            <select 
                                className="select"
                                value={filters.tipo} 
                                onChange={(e) => setFilters(prev => ({...prev, tipo: e.target.value}))}
                            >
                                <option value="">Seleccionar tipo</option>
                                {propertyTypes.map(type => (
                                <option key={type.value} value={type.value}>{type.label}</option>
                                ))}
                            </select>
                    </div>
                    
                    <label className="Titles-two">Ciudad/Municipio:</label>    
                        <div className='select' >
                        <select 
                            className="select"
                            value={filters.ciudad} 
                            onChange={(e) => setFilters(prev => ({...prev, ciudad: e.target.value}))}
                        >
                            <option value="">Seleccionar</option>
                            {cities.map(city => (
                                <option key={city.value} value={city.value}>{city.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <button 
                    onClick={fetchFilteredProperties}
                    disabled={!filters.tipo || !filters.ciudad || loading}
                    className="Button"
                >
                    {loading ? 'Buscando...' : 'Buscar Inmuebles'}
                </button>

                {loading && (
                    <div className="flex">
                        <div className="animate-spin"></div>
                    </div>
                )}

                {error && (
                    <div className="red">
                        <span className="block ">{error}</span>
                    </div>
                )}

                {!loading && filteredProperties.length > 0 && (
                    <div className="conatainer-table">
                        <table >
                            <thead>
                                <tr className="bg-gray">
                                    <th className="p-2 border">Código</th>
                                    <th className="p-2 border">Departamento</th>
                                    <th className="p-2 border">Municipio</th>
                                    <th className="p-2 border">Barrio</th>
                                    <th className="p-2 border">Tipo</th>
                                    <th className="p-2 border">Área</th>
                                    <th className="p-2 border">Características</th>
                                    <th className="p-2 border">Precio</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredProperties.map((property) => (
                                    <>
                                        <tr key={property._id} >
                                            
                                            <td className="p-2 border">{property.Codigo}</td>
                                            <td className="p-2 border">{property.Departamento}</td>
                                            <td className="p-2 border">{property.Municipio}</td>
                                            <td className="p-2 border">{property.Barrio}</td>
                                            <td className="p-2 border">{property.Tipo}</td>
                                            <td className="p-2 border">{property.Area} m²</td>
                                            <td className="p-2 border">
                                                <button 
                                                    onClick={() => toggleRowExpand(property._id)}
                                                
                                                >
                                                    {expandedRows.has(property._id) ? <FiChevronDown /> : <FiChevronRight />}
                                                    <span >Ver características</span>
                                                </button>
                                            </td>
                                            <td className="p-2 border">${property["Precio de lista"].toLocaleString()}</td>
                                            <td className="p-2 border">
                                                    <button 
                                                        onClick={() => fetchClientSuggestions(property)}
                                                        className="Button-client"
                                                    >
                                                        Sugerir Clientes
                                                    </button>
                                                </td>
                                        </tr>
                                        {expandedRows.has(property._id) && (
                                             <tr className="characteristics-expanded">
                                                 <td colSpan={8} className="p-2 border bg-gray-50">
                                                     <div className="characteristics-badges">
                                                        {formatCharacteristics(property.Caracteristicas).map((caracteristica, index) => (
                                                            <span 
                                                                  key={index} 
                                                                  className="characteristics-badge"
                                                            >
                                                                    {caracteristica}
                                                            </span>
                                                     ))}
                                                </div>
                                            </td>
                                        </tr>
                                        )}
                                    </>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="results-container">
                
                {selectedProperty && (
                    
                    <div className="selected-property-container">
                            <h3>Sugerencias de Clientes</h3>
                        <div className="suggestion-card">
                            <h4>Propiedad Seleccionada:</h4>
                            <div className="contact-info">
                                <p><strong>Código:</strong> {selectedProperty.Codigo}</p>
                                <p><strong>Tipo:</strong> {selectedProperty.Tipo}</p>
                                <p><strong>Departamento:</strong> {selectedProperty.Departamento}</p>
                                <p><strong>Ubicación:</strong> {selectedProperty.Municipio}, {selectedProperty.Barrio}</p>
                                <p><strong>Área:</strong> {selectedProperty.Area}</p>
                                <p><strong>Precio de lista:</strong> $ {selectedProperty["Precio de lista"].toLocaleString()}</p>
                            </div>
                        </div>
                        
                        {loadingSuggestions && (
                            <div className="suggestion-card loading">
                                <div className="loading-spinner" />
                                <p>Cargando sugerencias...</p>
                            </div>
                        )}

                        {suggestionError && (
                            <div className="suggestion-card">
                                <p className="justification error">{suggestionError}</p>
                            </div>
                        )}
                    
                        {clientSuggestions?.suggestions && (
                            <div className="suggestions-grid">
                                {clientSuggestions.suggestions.map((suggestion, index) => (
                                    <div key={index} className="suggestion-card">
                                        <h4>{suggestion.nombre_empresa}</h4>
                                        <p className="justification">{suggestion.justificacion}</p>
                                        <div className="contact-info">
                                            <h5>Información de Contacto</h5>
                                            <p><strong>Marca:</strong> {suggestion.contacto.marca}</p>
                                            <p><strong>Dirección:</strong> {suggestion.contacto.direccion}</p>
                                            <p><strong>Teléfono:</strong> {suggestion.contacto.telefono}</p>
                                            <p><strong>Email:</strong> {suggestion.contacto.email}</p>
                                            <p><strong>Sitio Web:</strong> {suggestion.contacto["sitio web"]}</p>
                                        </div>
                                    </div>
                                ))}  <div className="export-actions">
                                <button className="button-export"
                                    
                                >
                                    <FiPrinter /> Imprimir
                                </button>
                                <button 
                                    onClick={handlePdfDownload} 
                                    className="button-export"
                                    title="Descargar PDF"
                                >
                                    <FiDownload /> Descargar PDF
                                </button>
                            </div>          
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

function setTheme(arg0: string) {
    throw new Error('Function not implemented.');
}
