const Vehiculo = require('../models/vehiculo');

const vehiculoController = {
  createVehiculo: async (req, res) => {
    try {
      const vehiculo = await Vehiculo.create(req.body);
      res.status(201).json(vehiculo);
    } catch (error) {
      console.error('Error al crear vehículo:', error);
      res.status(500).json({ error: 'Error al crear vehículo' });
    }
  },

  getAll: async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;
    const { searchTerm } = req.query;
  
    try {
      const data = await Vehiculo.getAll(limit, offset, searchTerm);
      res.json(data);
    } catch (error) {
      console.error('Error al obtener vehículos:', error);
      res.status(500).json({ error: error });
    }
  },  

  getVehiculoById: async (req, res) => {
    const { id } = req.params;
    try {
      const vehiculo = await Vehiculo.getById(id);
      if (!vehiculo) {
        return res.status(404).json({ error: 'Vehículo no encontrado' });
      }
      res.json(vehiculo);
    } catch (error) {
      console.error('Error al obtener vehículo:', error);
      res.status(500).json({ error: 'Error al obtener vehículo' });
    }
  },

  updateVehiculo: async (req, res) => {
    const { id } = req.params;
    try {
      const { placa, userId, chasis, nuevasFotos = [], fotosExistentes = [] } = req.body;
  
      // Validaciones básicas opcionales
      if (!placa || !chasis || !userId) {
        return res.status(400).json({ error: 'Faltan campos obligatorios' });
      }
  
      const vehiculo = await Vehiculo.update(id, {
        placa,
        userId,
        chasis,
        nuevasFotos,
        fotosExistentes,
      });
  
      res.json(vehiculo);
    } catch (error) {
        
      console.error('Error al actualizar vehículo:', error);
      res.status(500).json({ error: 'Error al actualizar vehículo' });
    }
  },  

  deleteVehiculo: async (req, res) => {
    const { id } = req.params;
    try {
      const result = await Vehiculo.delete(id);
      res.json(result);
    } catch (error) {
      console.error('Error al eliminar vehículo:', error);
      res.status(500).json({ error: 'Error al eliminar vehículo' });
    }
  },
};

module.exports = vehiculoController;