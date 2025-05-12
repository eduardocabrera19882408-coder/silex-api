module.exports = (sequelize, DataTypes) => {
  const Ingreso = sequelize.define('Ingreso', {
    id: { 
      type: DataTypes.UUID, 
      defaultValue: DataTypes.UUIDV4, 
      primaryKey: true 
    },
    cajaId: { 
      type: DataTypes.UUID, 
      allowNull: false 
    },
    monto: { 
      type: DataTypes.FLOAT, 
      allowNull: false 
    },
    descripcion: { 
      type: DataTypes.STRING 
    },
    fecha: { 
      type: DataTypes.DATE, 
      allowNull: false 
    },
  }, {
    timestamps: true,
  });

  return Ingreso;
};

