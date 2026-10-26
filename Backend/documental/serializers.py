from rest_framework import serializers
from .models import TipoDocumento, EstadoDocumento, Documento, _local_date

class TipoDocumentoSerializer(serializers.ModelSerializer):
    en_uso = serializers.SerializerMethodField()

    class Meta:
        model = TipoDocumento
        fields = '__all__'
        extra_kwargs = {'vigencia_meses': {'min_value': 1, 'max_value': 120}}

    def get_en_uso(self, obj) -> bool:
        return obj.documentos.exists()

    def validate_nombre(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Ingresá un nombre.')
        others = TipoDocumento.objects.exclude(pk=getattr(self.instance, 'pk', None))
        if others.filter(nombre__iexact=value).exists():
            raise serializers.ValidationError('Ya existe un tipo de documento con ese nombre.')
        return value

    def validate(self, attrs):
        def current(field):
            return attrs.get(field, getattr(self.instance, field, TipoDocumento._meta.get_field(field).default))

        if not any(current(field) for field in ('aplica_jugador', 'aplica_socio', 'aplica_docente')):
            raise serializers.ValidationError({'perfiles': 'Elegí al menos un perfil al que aplica el documento.'})
        return attrs

class EstadoDocumentoSerializer(serializers.ModelSerializer):
    class Meta:
        model = EstadoDocumento
        fields = '__all__'

class DocumentoSerializer(serializers.ModelSerializer):
    persona_nombre_completo = serializers.SerializerMethodField()
    persona_es_activo = serializers.SerializerMethodField()
    categoria_nombre = serializers.SerializerMethodField()

    class Meta:
        model = Documento
        fields = '__all__'
        read_only_fields = ['nombre', 'estado_documento']

    def validate(self, attrs):
        issue_date = attrs.get('fecha_emision', getattr(self.instance, 'fecha_emision', None))
        due_date = attrs.get('fecha_vencimiento', getattr(self.instance, 'fecha_vencimiento', None))
        tipo = attrs.get('tipo_documento', getattr(self.instance, 'tipo_documento', None))
        if 'tipo_documento' in attrs and not tipo.activo and getattr(self.instance, 'tipo_documento', None) != tipo:
            raise serializers.ValidationError({'tipo_documento': 'El tipo de documento está deshabilitado.'})
        if tipo and tipo.requiere_vencimiento and not due_date:
            raise serializers.ValidationError({
                'fecha_vencimiento': f'El tipo "{tipo.nombre}" requiere fecha de vencimiento.'
            })
        if issue_date and due_date and _local_date(due_date) <= _local_date(issue_date):
            raise serializers.ValidationError({
                'fecha_vencimiento': 'La fecha de vencimiento debe ser posterior a la fecha de emisión.'
            })
        return attrs

    def get_persona_nombre_completo(self, obj):
        return f"{obj.persona.nombre} {obj.persona.apellido}"

    def get_persona_es_activo(self, obj):
        persona = obj.persona
        is_active = False
        if hasattr(persona, 'socio') and hasattr(persona.socio, 'jugador'):
            if persona.socio.jugador.estado and persona.socio.jugador.estado.nombre == 'Activo':
                is_active = True
        elif hasattr(persona, 'socio'):
            if persona.socio.estado_administrativo and persona.socio.estado_administrativo.nombre == 'Activo':
                is_active = True
                
        if hasattr(persona, 'docente'):
            if persona.docente.estado and persona.docente.estado.nombre == 'Activo':
                is_active = True
                
        return is_active

    def get_categoria_nombre(self, obj):
        persona = obj.persona
        if hasattr(persona, 'socio') and hasattr(persona.socio, 'jugador'):
            jugador = persona.socio.jugador
            if jugador.categoria:
                return jugador.categoria.nombre
            return 'Jugador'
        if hasattr(persona, 'docente'):
            return 'Docente'
        return 'Socio'

    url_perfil = serializers.SerializerMethodField()

    def get_url_perfil(self, obj):
        persona = obj.persona
        if hasattr(persona, 'socio') and hasattr(persona.socio, 'jugador'):
            return f"/padron/jugadores/{persona.socio.jugador.jugador_id}"
        if hasattr(persona, 'docente'):
            return f"/padron/docentes/{persona.docente.docente_id}"
        return "#"

