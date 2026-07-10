import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

/**
 * Valida un campo multiidioma con forma `{ locale: texto }`.
 * Reglas: objeto no vacio, claves string no vacias, valores string no vacios.
 * Ej. valido: { es: 'Cerveza', en: 'Beer' }.
 */
export function IsLocalizedText(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isLocalizedText',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            return false;
          }
          const entries = Object.entries(value as Record<string, unknown>);
          if (entries.length === 0) {
            return false;
          }
          return entries.every(
            ([key, val]) =>
              typeof key === 'string' &&
              key.trim().length > 0 &&
              typeof val === 'string' &&
              val.trim().length > 0,
          );
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} debe ser un objeto multiidioma { locale: texto } con al menos un idioma y textos no vacios`;
        },
      },
    });
  };
}
