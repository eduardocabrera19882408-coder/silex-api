module.exports = (sequelize, DataTypes) => {
  const Pago = sequelize.define('Pago', {
    id: { 
      type: DataTypes.UUID, 
      defaultValue: DataTypes.UUIDV4, 
      primaryKey: true 
    },
    creditoId: { 
      type: DataTypes.UUID, 
      allowNull: false 
    },
    monto: { 
      type: DataTypes.FLOAT, 
      allowNull: false 
    },
    fechaPago: { 
      type: DataTypes.DATE, 
      allowNull: false 
    },
    metodoPago: { 
      type: DataTypes.STRING 
    },
  }, {
    timestamps: true,
  });

  // Relaciones
  Pago.associate = (models) => {
    Pago.belongsTo(models.Credito, {
      foreignKey: 'creditoId',
      as: 'credito',
    });
  };

  return Pago;
};

