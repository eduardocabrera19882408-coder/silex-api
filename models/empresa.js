module.exports = (sequelize, DataTypes) => {
  const Empresa = sequelize.define('Empresa', {
    id: { 
      type: DataTypes.UUID, 
      defaultValue: DataTypes.UUIDV4, 
      primaryKey: true 
    },
    nombre: { 
      type: DataTypes.STRING, 
      allowNull: false 
    },
    ruc: { 
      type: DataTypes.STRING, 
      unique: true, 
      allowNull: false 
    },
    direccion: { 
      type: DataTypes.STRING 
    },
    telefono: { 
      type: DataTypes.STRING 
    },
    correo: { 
      type: DataTypes.STRING 
    },
    logo: { 
      type: DataTypes.STRING 
    },
  }, {
    timestamps: true,
  });

  return Empresa;
};

