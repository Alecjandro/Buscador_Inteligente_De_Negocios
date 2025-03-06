from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
import pandas as pd
from pymongo import MongoClient
import logging
from datetime import datetime
import config
import json
from bson import json_util, ObjectId
from Estadisticas import RealEstateStats

# Configuración de logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Inicialización de la aplicación Flask
app = Flask(__name__)
CORS(app)

# Configuración de la API de OpenAI y conexión a MongoDB Atlas
client = OpenAI(api_key=config.api_key)

# Conexión a MongoDB Atlas
mongo_client = MongoClient(config.mongodb_uri)
db = mongo_client['Vitrina']  # Asegúrate de que "Vitrina" es el nombre de la base de datos
estadistica = RealEstateStats(db)

# Prompt de sistema para el asistente de IA
SYSTEM_PROMPT = """Eres un asistente comercial especializado en bienes raíces que:
1. Analiza las características de los inmuebles, incluyendo tamaño (m²), precio, y ubicación.
2. Sugiere únicamente clientes potenciales (empresas) que realmente podrían estar interesados en el inmueble,
   considerando que algunas empresas no compran propiedades por debajo o por encima de ciertos tamaños y precios.
3. Proporciona información de contacto relevante y verificable de empresas reales interesadas.
4. Justifica por qué cada empresa sería un cliente potencial adecuado, 
   basándote en sus preferencias conocidas y las características del inmueble.
5. Proporciona los datos de contacto de manera estructurada para facilitar su uso.

Formato de respuesta requerido:
{
    "suggestions": [
        {
            "nombre_empresa": "",
            "justificacion": "",
            "contacto": {
                "marca": "",
                "direccion": "",
                "telefono": "",
                "email": "",
                "sitio web": ""
            }
        }
    ]
}

IMPORTANTE:
1. La respuesta DEBE ser un objeto JSON válido exactamente con esta estructura.
2. Asegúrate de filtrar las empresas con base en sus criterios conocidos de tamaño y precio, 
para entregar únicamente clientes que realmente podrían estar interesados.
"""

@app.route('/api/property-stats/<property_id>', methods=['GET'])
def get_property_stats(property_id):
    try:
        if not ObjectId.is_valid(property_id):
            return jsonify({'error': 'ID de inmueble no válido'}), 400

        stats = estadistica.calculate_property_stats(property_id)
        
        # Crear archivo CSV para Power BI
        property_stats_df = pd.DataFrame({
            'Métrica': [
                'Precio por m²',
                'Precio promedio zona',
                'Diferencia con mercado (%)',
                'ROI anual estimado (%)',
                'Puntuación de demanda'
            ],
            'Valor': [
                stats['basic_metrics']['price_per_sqm'],
                stats['area_comparison']['avg_price'],
                stats['area_comparison']['price_difference'],
                stats['investment_metrics']['annual_roi'],
                stats['zone_demand']['demand_score']
            ]
        })

        # Guardar para Power BI
        csv_filename = f'property_stats_{property_id}.csv'
        property_stats_df.to_csv(f'powerbi_data/{csv_filename}', index=False)
        
        return jsonify({
            'stats': stats,
            'csv_file': csv_filename
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Endpoint para obtener inmuebles con filtros de tipo y ciudad
@app.route('/api/inmuebles', methods=['GET'])
def get_inmuebles():
    try:
        # Log de los parámetros recibidos
        tipo_inmueble = request.args.get('Tipo', '').strip()
        ciudad = request.args.get('Municipio', '').strip()
        logger.debug(f"Parámetros recibidos - Tipo: {tipo_inmueble}, Municipio: {ciudad}")

        # Construcción de la query
        query = {}
        if tipo_inmueble:
            query["Tipo"] = {"$regex": f"^{tipo_inmueble}$", "$options": "i"}
        if ciudad:
            query["Municipio"] = {"$regex": f"^{ciudad}$", "$options": "i"}

        logger.debug(f"Query MongoDB: {query}")

        # Ejecutar la consulta
        cursor = db.Inmuebles1.find(query)
        inmuebles = list(cursor)
        
        logger.debug(f"Número de inmuebles encontrados: {len(inmuebles)}")
        
        # Procesar y verificar cada documento
        processed_inmuebles = []
        for doc in inmuebles:
            processed_doc = {
                "_id": str(doc["_id"]),
                "Codigo": doc.get("Codigo", "N/A"),
                "Departamento": doc.get("Departamento", "N/A"),
                "Municipio": doc.get("Municipio", "N/A"),
                "Tipo": doc.get("Tipo", "N/A"),
                "Barrio": doc.get("Barrio", "N/A"),
                "Area": doc.get("Area", 0),
                "Caracteristicas": doc.get("Caracteristicas", []),
                "Precio de lista": doc.get("Precio de lista", 0)
            }
            processed_inmuebles.append(processed_doc)
            logger.debug(f"Documento procesado: {processed_doc}")

        # Verificar que la respuesta sea JSON serializable
        response = jsonify(processed_inmuebles)
        logger.debug(f"Respuesta final: {response.get_data(as_text=True)}")
        
        return response

    except Exception as e:
        logger.error(f"Error en get_inmuebles: {str(e)}", exc_info=True)
        return jsonify({
            'error': 'Error al obtener inmuebles',
            'message': str(e),
            'status': 'error'
        }), 500


# Endpoint para sugerir clientes potenciales basados en un inmueble específico
@app.route('/api/suggest-clients', methods=['POST'])
def suggest_clients():
    try:
        # Obtención de datos del inmueble seleccionado
        data = request.json
        inmueble_id = data.get('inmueble_id')
        
        # Validación de inmueble_id
        if not ObjectId.is_valid(inmueble_id):
            return jsonify({'error': 'ID de inmueble no válido'}), 400

        # Consulta para obtener el inmueble específico desde MongoDB
        inmueble = db.Inmuebles1.find_one({"_id": ObjectId(inmueble_id)})
        if not inmueble:
            return jsonify({'error': 'Inmueble no encontrado'}), 404

        # Preparación de detalles del inmueble para el prompt
        property_details = {
            "Código": inmueble.get("Codigo", "N/A"),
            "Departamento": inmueble.get("Departamento", "N/A"),
            "Municipio": inmueble.get("Municipio", "N/A"),
            "Tipo": inmueble.get("Tipo", "N/A"),
            "Barrio": inmueble.get("Barrio", "N/A"),
            "Área": inmueble.get("Area", "N/A"),
            "Características": inmueble.get("Caracteristicas", []),
            "Precio de lista": inmueble.get("Precio de lista", "N/A")
        }

        # Prompt para solicitar sugerencias de clientes a OpenAI
        prompt = f"""
        Basado en el siguiente inmueble:
        {property_details}

       Considera lo siguiente al hacer las sugerencias:
       1. El tamaño, precio y características del inmueble.
       2. La ubicación en el barrio, incluyendo los negocios existentes en esa área.

       Sugiere 6 empresas que podrían estar interesadas en este inmueble, considerando:
       - Negocios o empresas que ya podrían estar en el barrio y que coinciden con las características del inmueble.
       - Negocios que podrían faltar en el barrio y que este inmueble podría atraer, 
         basándote en las necesidades del área y las oportunidades de mercado.

       Justifica por qué cada empresa sería un cliente potencial adecuado, proporcionando datos realistas y relevantes,
       y considerando las características del inmueble y del barrio.  

        IMPORTANTE: Tu respuesta DEBE ser un objeto JSON válido con la estructura exacta proporcionada.
        """

        # Llamada a la API de OpenAI con el modelo GPT-3.5-turbo
        response = client.chat.completions.create(
            model="gpt-4-turbo",
            messages=[{"role": "system", "content": SYSTEM_PROMPT},
                      {"role": "user", "content": prompt}]
        )

        # Procesamiento de la respuesta de OpenAI
        suggestions_text = response.choices[0].message.content.strip()
        try:
            suggestions_json = json.loads(suggestions_text)
        except json.JSONDecodeError:
            return jsonify({'suggestions': [], 'error': 'La respuesta de OpenAI no es un JSON válido.'}), 500

        # Registro de la búsqueda en la base de datos para auditoría
        search_record = {
            'property_details': property_details,
            'suggestions': suggestions_json,
            'timestamp': datetime.now()
        }
        db.searches.insert_one(search_record)

        # Respuesta con las sugerencias al cliente
        return jsonify(suggestions_json)

    except Exception as e:
        return jsonify({'suggestions': [], 'error': str(e)}), 500

# Inicio de la aplicación en el puerto 5000 si se ejecuta como script principal
if __name__ == '__main__':
    app.run(port=5000, debug=True)
