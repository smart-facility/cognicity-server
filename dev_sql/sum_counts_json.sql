	SELECT 'FeatureCollection' AS type, array_to_json(array_agg(f)) AS features FROM (SELECT 'Feature' AS type, ST_AsGeoJSON(lg.the_geom)::json As geometry, 
	row_to_json((SELECT l FROM (SELECT lg.pkey, lg.area_name as level_name, lg.sum_count as count) AS l)) AS properties 
		FROM (
			SELECT c1.pkey, c1.area_name, c1.the_geom, c1.count+c2.count sum_count 
			FROM (
				SELECT p1.pkey, p1.area_name, p1.the_geom, COALESCE(count.count,0) count 
				FROM jkt_village_boundary AS p1 LEFT OUTER JOIN(SELECT b.pkey, count(a.pkey) 
					FROM unconfirmed_reports a, jkt_Village_boundary b WHERE ST_WITHIN(a.the_geom, b.the_geom) GROUP BY b.pkey) as count ON (p1.pkey = count.pkey)) as c1, (
				SELECT p1.pkey, COALESCE(count.count,0) count 
				FROM jkt_village_boundary AS p1 LEFT OUTER JOIN(SELECT b.pkey, count(a.pkey) 
					FROM reports a, jkt_Village_boundary b WHERE ST_WITHIN(a.the_geom, b.the_geom) GROUP BY b.pkey) as count ON (p1.pkey = count.pkey)) as c2 
			WHERE c1.pkey=c2.pkey ORDER BY pkey) AS lg) AS f;