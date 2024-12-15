"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class AnimalToAnimalRescue extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      AnimalToAnimalRescue.belongsTo(models.Animal, {
        foreignKey: "animal_id",
        onDelete: "CASCADE",
      });
      console.log(models);
      AnimalToAnimalRescue.belongsTo(models.AnimalRescue, {
        foreignKey: "animal_rescue_id",
        onDelete: "CASCADE",
      });
      models.Animal.hasMany(AnimalToAnimalRescue, {
        sourceKey: "id",
        foreignKey: "animal_id",
        as: "animals_to_animal_rescues",
      });
      models.AnimalRescue.hasMany(AnimalToAnimalRescue, {
        sourceKey: "id",
        foreignKey: "animal_rescue_id",
        as: "animals_to_animal_rescues",
      });
    }
  }
  AnimalToAnimalRescue.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      animal_id: DataTypes.INTEGER,
      animal_rescue_id: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "AnimalToAnimalRescue",
    }
  );
  return AnimalToAnimalRescue;
};
