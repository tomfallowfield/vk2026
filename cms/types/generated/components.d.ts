import type { Schema, Struct } from '@strapi/strapi';

export interface SharedLeadMagnetConfig extends Struct.ComponentSchema {
  collectionName: 'components_shared_lead_magnet_configs';
  info: {
    description: 'Per-lead-magnet settings. form_id must match form id (e.g. lead-50things).';
    displayName: 'Lead magnet config';
  };
  attributes: {
    enabled: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    form_id: Schema.Attribute.String & Schema.Attribute.Required;
    mailchimp_tag: Schema.Attribute.String;
    success_message: Schema.Attribute.String;
  };
}

export interface SharedLinkedinFace extends Struct.ComponentSchema {
  collectionName: 'components_shared_linkedin_faces';
  info: {
    description: 'Avatar for hero stack. Tooltip shows Name \u2013 Role.';
    displayName: 'LinkedIn face';
  };
  attributes: {
    name: Schema.Attribute.String & Schema.Attribute.Required;
    photo: Schema.Attribute.String;
    role: Schema.Attribute.String;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'shared.lead-magnet-config': SharedLeadMagnetConfig;
      'shared.linkedin-face': SharedLinkedinFace;
    }
  }
}
